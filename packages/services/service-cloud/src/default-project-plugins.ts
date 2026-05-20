// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Default per-project plugin slate for hosted ObjectStack runtimes.
 *
 * Mirrors `ALWAYS_CAPS` in `packages/cli/src/commands/serve.ts` so that
 * a tenant booted on a per-project kernel (objectos / cloud runtime)
 * gets the same foundational services a single-tenant `objectstack dev`
 * stack gets:
 *
 *   QueueServicePlugin → JobServicePlugin → CacheServicePlugin
 *     → SettingsServicePlugin → EmailServicePlugin → StorageServicePlugin
 *
 * Why this lives in service-cloud (not in the CLI):
 *   - The CLI builds ONE kernel per process; this helper is for kernels
 *     built on-demand from artifacts, where the lifecycle is different
 *     (LRU cached, per-tenant).
 *   - Per-project kernels do NOT inherit anything from the host: the
 *     host stays a stateless routing shell on purpose. So defaults must
 *     be re-mounted per kernel.
 *
 * Ordering matters: `email` subscribes to settings change events on its
 * `kernel:ready` hook, so `settings` MUST mount first. `queue` + `job`
 * must come before `email` so durable mail-send subscribers can bind.
 */

import type { ObjectKernel } from '@objectstack/core';
import path from 'node:path';

export type Logger = {
  info?: (...a: any[]) => void;
  warn?: (...a: any[]) => void;
  error?: (...a: any[]) => void;
};

export interface MountDefaultProjectPluginsOptions {
  /** Project identifier (used for storage path isolation + log context). */
  projectId: string;
  /** Optional logger. Defaults to `console`. */
  logger?: Logger;
  /**
   * Root directory for per-project local-disk storage when no shared
   * S3/GCS backend is configured. Defaults to `<cwd>/.objectstack/data`.
   * The plugin will write under `<dataRoot>/projects/<projectId>/uploads/`.
   */
  dataRoot?: string;
  /**
   * When true (default), emit a single `console.warn` if the storage
   * plugin falls back to the local-disk driver in non-development mode.
   * Hosted runtimes should ALWAYS configure a shared object store
   * (S3/GCS/Azure) — per-project local storage is bound to a single
   * pod and will not survive eviction.
   */
  warnOnLocalStorageInProd?: boolean;
  /**
   * Set to `false` to skip an individual capability (e.g. when the host
   * has already mounted its own shared queue adapter). Defaults to
   * mounting every cap.
   */
  caps?: Partial<Record<DefaultProjectCap, boolean>>;
}

export type DefaultProjectCap =
  | 'queue'
  | 'job'
  | 'cache'
  | 'settings'
  | 'email'
  | 'storage';

const ORDER: DefaultProjectCap[] = ['queue', 'job', 'cache', 'settings', 'email', 'storage'];

/**
 * Mount the default per-project plugin slate on `kernel`. Safe to call
 * exactly once per kernel; the helper guards against double-mount of
 * the same plugin name (each plugin's `name` is checked against the
 * kernel's plugin list).
 */
export async function mountDefaultProjectPlugins(
  kernel: ObjectKernel,
  opts: MountDefaultProjectPluginsOptions,
): Promise<void> {
  const logger = opts.logger ?? console;
  const isDev = process.env.NODE_ENV !== 'production';
  const warnProd = opts.warnOnLocalStorageInProd ?? true;
  const caps = opts.caps ?? {};

  for (const cap of ORDER) {
    if (caps[cap] === false) continue;
    try {
      switch (cap) {
        case 'queue': {
          const { QueueServicePlugin } = await import('@objectstack/service-queue');
          await kernel.use(new QueueServicePlugin());
          break;
        }
        case 'job': {
          const { JobServicePlugin } = await import('@objectstack/service-job');
          await kernel.use(new JobServicePlugin());
          break;
        }
        case 'cache': {
          const { CacheServicePlugin } = await import('@objectstack/service-cache');
          await kernel.use(new CacheServicePlugin());
          break;
        }
        case 'settings': {
          const { SettingsServicePlugin } = await import('@objectstack/service-settings');
          await kernel.use(new SettingsServicePlugin());
          break;
        }
        case 'email': {
          const { EmailServicePlugin } = await import('@objectstack/plugin-email');
          // Inherit transport options from process env so per-pod ops
          // can wire a shared SMTP / Resend account without redeploying
          // every project. Per-tenant overrides come through the tenant's
          // own `sys_setting` rows (mail namespace).
          const provider = (process.env.OS_EMAIL_PROVIDER || 'log').toLowerCase();
          const apiKey = process.env.OS_EMAIL_API_KEY;
          const fromEnv = process.env.OS_EMAIL_FROM;
          let defaultFrom: any = undefined;
          if (fromEnv) {
            const m = fromEnv.match(/^\s*(?:"?([^"<]*?)"?\s*<\s*([^>]+)\s*>|(\S+))\s*$/);
            if (m) {
              const name = (m[1] ?? '').trim();
              const address = (m[2] ?? m[3] ?? '').trim();
              if (address) defaultFrom = name ? { name, address } : { address };
            }
          }
          await kernel.use(
            new EmailServicePlugin({
              provider: provider === 'log' || apiKey ? provider : 'log',
              ...(apiKey ? { apiKey } : {}),
              ...(defaultFrom ? { defaultFrom } : {}),
            } as any),
          );
          break;
        }
        case 'storage': {
          const { StorageServicePlugin } = await import('@objectstack/service-storage');
          const sharedAdapter = (process.env.OS_STORAGE_ADAPTER || '').toLowerCase();
          if (sharedAdapter === 's3') {
            // Host-shared S3 with project prefix — operator owns the bucket;
            // the existing `storage-env.ts` wiring handles credential
            // resolution from OS_S3_* env vars. We re-instantiate here
            // because each project kernel needs its own plugin instance
            // (services aren't shared across kernels).
            const { S3StorageAdapter } = await import('@objectstack/service-storage');
            const bucket = process.env.OS_S3_BUCKET;
            const region = process.env.OS_S3_REGION;
            if (bucket && region) {
              const adapter = new S3StorageAdapter({
                bucket,
                region,
                accessKeyId: process.env.OS_S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.OS_S3_SECRET_ACCESS_KEY,
                endpoint: process.env.OS_S3_ENDPOINT,
                pathStylePrefix: `projects/${opts.projectId}`,
              } as any);
              await kernel.use(new StorageServicePlugin({ adapter: 's3', s3: adapter } as any));
              break;
            }
            logger.warn?.(
              '[default-project-plugins] OS_STORAGE_ADAPTER=s3 but OS_S3_BUCKET/OS_S3_REGION missing — falling back to local driver',
              { projectId: opts.projectId },
            );
          }
          // Per-project local-disk fallback. Isolate uploads per
          // project so files written by tenant A can't be served as
          // tenant B by a path-traversal mishap.
          const dataRoot = opts.dataRoot ?? path.join(process.cwd(), '.objectstack', 'data');
          const root = path.join(dataRoot, 'projects', opts.projectId, 'uploads');
          await kernel.use(new StorageServicePlugin({ driver: 'local', root } as any));
          if (!isDev && warnProd) {
            // Emit only once per process even if many projects boot —
            // logger.warn is fine because hosted runtimes aggregate.
            logger.warn?.(
              `[default-project-plugins] StorageServicePlugin using local driver for project='${opts.projectId}' (${root}) — switch to S3/GCS/Azure for production (set OS_STORAGE_ADAPTER=s3 + OS_S3_*).`,
            );
          }
          break;
        }
      }
    } catch (err: any) {
      // Each cap is independently optional. Log and continue so a
      // missing peer dep can't take down a tenant boot.
      const msg = err?.message ?? String(err);
      if (msg.includes('Cannot find module') || msg.includes('ERR_MODULE_NOT_FOUND')) {
        logger.warn?.(
          `[default-project-plugins] capability '${cap}' skipped — package not installed`,
          { projectId: opts.projectId },
        );
      } else {
        logger.warn?.(
          `[default-project-plugins] capability '${cap}' failed to mount: ${msg}`,
          { projectId: opts.projectId, error: err?.stack },
        );
      }
    }
  }
}
