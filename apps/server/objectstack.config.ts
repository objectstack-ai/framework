// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectStack Server — Host Configuration
 *
 * Booted by `objectstack dev` / `objectstack serve` (see `package.json`).
 *
 * The CLI loads this file, registers the plugins below on a fresh
 * `ObjectKernel`, then auto-mounts the standard HTTP stack
 * (HonoServerPlugin, Setup, RestAPI, Dispatcher, I18nService).
 *
 * Our plugin list:
 *  1. `createControlPlanePlugins(...)` — ObjectQL + driver + tenant +
 *     system-project + auth/security/audit + metadata for `sys_*`.
 *  2. `MultiProjectPlugin` — registers `env-registry`, `kernel-manager`
 *     and `template-seeder` on the control kernel so HttpDispatcher can
 *     route requests to per-project kernels via hostname / X-Project-Id.
 *
 * The control-plane driver is selected from a single URL-style env var
 * (Turso/Prisma convention):
 *
 *   OBJECTSTACK_DATABASE_URL
 *     - unset                 → `file:./.objectstack/data/control.db`
 *     - `file:<path>` / path  → SQLite at that path (better-sqlite3)
 *     - `libsql://…`          → libSQL/Turso
 *     - `http(s)://…`         → libSQL/sqld over HTTP
 *
 *   OBJECTSTACK_DATABASE_AUTH_TOKEN — optional, for libSQL/HTTP URLs.
 */

import { resolve as resolvePath } from 'node:path';
import type { Contracts } from '@objectstack/spec';
import {
    type BasePluginsFactory,
    type AppBundleResolver,
} from '@objectstack/runtime';
import { createControlPlanePlugins } from './server/control-plane-preset.js';
import { templateRegistry } from './server/templates/registry.js';

type IDataDriver = Contracts.IDataDriver;

/**
 * Resolve the control-plane driver from `OBJECTSTACK_DATABASE_URL`.
 * Drivers are loaded via dynamic import() so esbuild does not bundle
 * the database libraries (better-sqlite3, libsql) at parse time.
 */
async function buildControlDriver(): Promise<{
    driver: IDataDriver;
    driverName: 'sqlite' | 'turso';
    databaseUrl: string;
}> {
    const raw = (process.env.OBJECTSTACK_DATABASE_URL || process.env.TURSO_DATABASE_URL)?.trim()
        || `file:${resolvePath(process.cwd(), '.objectstack/data/control.db')}`;

    const authToken = process.env.OBJECTSTACK_DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

    if (/^(libsql|https?):\/\//i.test(raw)) {
        const { TursoDriver } = await import('@objectstack/driver-turso');
        const driver = new TursoDriver({ url: raw, authToken });
        return { driver: driver as unknown as IDataDriver, driverName: 'turso', databaseUrl: raw };
    }

    const filename = raw.replace(/^file:(\/\/)?/, '');
    const { SqlDriver } = await import('@objectstack/driver-sql');
    const driver = new SqlDriver({ client: 'better-sqlite3', connection: { filename }, useNullAsDefault: true });
    return { driver: driver as unknown as IDataDriver, driverName: 'sqlite', databaseUrl: `file:${filename}` };
}

const authSecret = process.env.AUTH_SECRET
    ?? 'dev-secret-please-change-in-production-min-32-chars';
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined)
    ?? (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : undefined)
    ?? `http://localhost:${process.env.PORT ?? 3000}`;

// Per-project kernels share a minimal base. Loaded lazily on project provisioning.
const basePlugins: BasePluginsFactory = async ({ projectId }) => {
    const { ObjectQLPlugin } = await import('@objectstack/objectql');
    const { MetadataPlugin } = await import('@objectstack/metadata');
    return [
        new ObjectQLPlugin({ environmentId: projectId }),
        new MetadataPlugin({ watch: false, environmentId: projectId }),
    ];
};

// Example bundles are seeded into a project at provisioning time via
// the template-seeder — not pre-installed into every project kernel.
const appBundles: AppBundleResolver = {
    async resolve() { return []; },
};

// Single shared promise — both control-plane plugins and MultiProjectPlugin
// use the same DB connection. buildControlDriver() is called only once.
const controlDriverPromise = buildControlDriver();

// Lazy-loading wrapper for MultiProjectPlugin — the control driver is built
// asynchronously so it is not imported at module evaluation time.
const multiProjectPluginProxy: any = {
    name: 'com.objectstack.multi-project',
    version: '0.0.0',
    _impl: null as any,
    async init(ctx: any) {
        const { driver: controlDriver } = await controlDriverPromise;
        const { MultiProjectPlugin: MPlugin } = await import('@objectstack/runtime');
        this._impl = new MPlugin({
            controlDriver,
            basePlugins,
            appBundles,
            templates: templateRegistry,
            maxSize: Number(process.env.OBJECTSTACK_KERNEL_CACHE_SIZE ?? 32),
            ttlMs: Number(process.env.OBJECTSTACK_KERNEL_TTL_MS ?? 15 * 60 * 1000),
            cacheTTLMs: Number(process.env.OBJECTSTACK_ENV_CACHE_TTL_MS ?? 5 * 60 * 1000),
        });
        if (this._impl.init) await this._impl.init(ctx);
    },
    async start(ctx: any) {
        if (this._impl?.start) await this._impl.start(ctx);
    },
    async stop(ctx: any) {
        if (this._impl?.stop) await this._impl.stop(ctx);
    },
};

export default {
    plugins: [
        ...createControlPlanePlugins({
            controlDriverPromise,
            authSecret,
            baseUrl,
        }),
        multiProjectPluginProxy,
    ],
    // Project-scoping config consumed by `createRestApiPlugin` and
    // `createDispatcherPlugin` (auto-registered by `objectstack serve`).
    api: {
        enableProjectScoping: true,
        projectResolution: 'auto' as const,
    },
};
