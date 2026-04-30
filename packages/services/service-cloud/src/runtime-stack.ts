// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Project-mode stack factory.
 *
 * Reuses `createCloudStack()` with two local SQLite files
 * (`control.db` for the control plane and `<project_id>.db` for
 * the single project's business data). The cloud preset's per-project
 * factory is replaced with one that registers only the engines needed
 * to materialize business data — identity, auth, security, audit,
 * tenant catalogs and packages live in the control plane.
 *
 * The dataset:
 *
 *   <dataDir>/
 *   ├── control.db       — control plane (sys_organization, sys_project, …)
 *   └── proj_local.db    — single-project business data
 */

import { resolve as resolvePath } from 'node:path';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { createCloudStack } from './cloud-stack.js';
import { createSingleProjectPlugin } from './single-project-plugin.js';
import { resolveAuthSecret, resolveBaseUrl } from './boot-env.js';
import type { AppBundleResolver } from './project-kernel-factory.js';
import { createObjectOSStack } from './objectos-stack.js';

/**
 * Default ObjectStack Cloud base URL used when neither `cloudUrl` nor
 * `OBJECTSTACK_CLOUD_URL` is set. Override via the env var or
 * `ProjectStackConfig.cloudUrl`. Set to `local` to disable cloud routing
 * and boot from a local `control.db` instead.
 */
export const DEFAULT_CLOUD_URL = 'https://cloud.objectstack.ai';

export const ProjectStackConfigSchema = z.object({
    /** Auth secret (defaults to env / dev fallback). */
    authSecret: z.string().optional(),
    /** Public origin used by better-auth (defaults to env). */
    baseUrl: z.string().optional(),
    /** Project id used as the seeded `sys_project.id`. Default: `proj_local`. */
    projectId: z.string().optional(),
    /** Compiled artifact path. Default: `<cwd>/dist/objectstack.json`. */
    artifactPath: z.string().optional(),
    /** Data directory holding `control.db` + `<projectId>.db`. Default: `<cwd>/.objectstack/data`. */
    dataDir: z.string().optional(),
    /** Per-project AppBundleResolver. */
    appBundles: z.custom<AppBundleResolver>().optional(),
    /** API prefix (passed through to the cloud preset). */
    apiPrefix: z.string().optional(),
    /**
     * ObjectStack Cloud base URL. Defaults to `https://cloud.objectstack.ai`
     * (override via the `OBJECTSTACK_CLOUD_URL` env var or this field).
     *
     * When non-empty (the default), the project stack runs in **ObjectOS
     * Cloud Runtime** mode: no local control-plane database, projects are
     * resolved by hostname against ObjectStack Cloud and per-project
     * kernels are booted from artifacts pulled over HTTP.
     *
     * To run the legacy local-control-plane mode (single SQLite
     * `control.db` shared with one `proj_local.db`) instead, set the env
     * var to the sentinel value `local` (`OBJECTSTACK_CLOUD_URL=local`)
     * or pass `cloudUrl: 'local'`.
     */
    cloudUrl: z.string().optional(),
    /** Bearer token for the ObjectStack Cloud API (defaults to `OBJECTSTACK_CLOUD_API_KEY`). */
    cloudApiKey: z.string().optional(),
});

export type ProjectStackConfig = z.input<typeof ProjectStackConfigSchema>;

export interface ProjectStackResult {
    plugins: any[];
    api: { enableProjectScoping: true; projectResolution: 'auto' };
}

/**
 * Build the plugin list for `project` mode. Returns the same shape as
 * `createCloudStack()` so callers can return the result directly from a
 * host config's `default export`.
 */
export async function createProjectStack(config?: ProjectStackConfig): Promise<ProjectStackResult> {
    const cfg = ProjectStackConfigSchema.parse(config ?? {});

    // ── ObjectOS Cloud Runtime branch ─────────────────────────────────────
    // Default: route every per-project boot through ObjectStack Cloud
    // (https://cloud.objectstack.ai) — no local control-plane DB, projects
    // are resolved by hostname against the cloud API and kernels are
    // booted from remote-fetched artifacts. To opt out and use the legacy
    // single-control-DB local mode, set OBJECTSTACK_CLOUD_URL=local
    // (or `cloudUrl: 'local'`). See objectos-stack.ts.
    const rawCloudUrl = cfg.cloudUrl ?? process.env.OBJECTSTACK_CLOUD_URL ?? DEFAULT_CLOUD_URL;
    const cloudUrl = rawCloudUrl.trim();
    const localOptOut = cloudUrl === '' || cloudUrl.toLowerCase() === 'local' || cloudUrl.toLowerCase() === 'off';
    if (!localOptOut) {
        return createObjectOSStack({
            controlPlaneUrl: cloudUrl,
            controlPlaneApiKey: cfg.cloudApiKey ?? process.env.OBJECTSTACK_CLOUD_API_KEY,
            apiPrefix: cfg.apiPrefix,
        }) as Promise<ProjectStackResult>;
    }

    const cwd = process.cwd();
    const projectId = cfg.projectId ?? process.env.OBJECTSTACK_PROJECT_ID ?? 'proj_local';
    const artifactPath = cfg.artifactPath
        ?? process.env.OBJECTSTACK_ARTIFACT_PATH
        ?? resolvePath(cwd, 'dist/objectstack.json');
    const dataDir = cfg.dataDir ?? resolvePath(cwd, '.objectstack/data');
    mkdirSync(dataDir, { recursive: true });

    const controlDbUrl = `file:${resolvePath(dataDir, 'control.db')}`;
    const projectDbUrl = `file:${resolvePath(dataDir, `${projectId}.db`)}`;

    const authSecret = cfg.authSecret ?? resolveAuthSecret();
    const baseUrl = cfg.baseUrl ?? resolveBaseUrl();

    const stack = await createCloudStack({
        authSecret,
        baseUrl,
        controlDriverUrl: controlDbUrl,
        appBundles: cfg.appBundles,
        apiPrefix: cfg.apiPrefix,
        // Project-mode per-project plugins. The control plane (created by
        // `createCloudStack`'s preset) is the sole owner of identity,
        // authentication, security, audit, tenant catalogs, and packages —
        // their tables live in `control.db`. Each per-project kernel only
        // registers the engines needed to materialize that project's
        // business data schemas + records.
        basePlugins: async ({ projectId: pid }: { projectId: string }) => {
            const { ObjectQLPlugin } = await import('@objectstack/objectql');
            const { MetadataPlugin } = await import('@objectstack/metadata');
            const { AppPlugin } = await import('@objectstack/runtime');

            let artifactBundle: any = null;
            try {
                const raw = await readFile(artifactPath, 'utf8');
                const parsed = JSON.parse(raw);
                artifactBundle = (parsed?.schemaVersion != null && parsed?.metadata !== undefined)
                    ? parsed.metadata
                    : parsed;
            } catch {
                // First boot before `objectstack build` — AppPlugin skipped.
            }

            const plugins: any[] = [
                new ObjectQLPlugin({ environmentId: pid }),
                new MetadataPlugin({
                    watch: false,
                    environmentId: pid,
                    artifactSource: { mode: 'local-file', path: artifactPath },
                    // sys_* metadata-storage tables live in the control plane only.
                    registerSystemObjects: false,
                }),
            ];
            if (artifactBundle) plugins.push(new AppPlugin(artifactBundle));
            return plugins;
        },
    });

    // The cloud preset registers a `studio/runtime-config` route returning
    // `{ singleProject: false }`. Drop it and substitute our own which
    // seeds local identity AND emits `{ singleProject: true, … }`.
    const filtered = stack.plugins.filter(
        (p: any) => p?.name !== 'com.objectstack.studio.runtime-config',
    );
    filtered.push(
        createSingleProjectPlugin({
            projectId,
            projectDatabaseUrl: projectDbUrl,
            projectDatabaseDriver: 'sqlite',
            apiPrefix: cfg.apiPrefix,
        }),
    );

    return {
        plugins: filtered,
        api: stack.api,
    };
}
