// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectStack Server — Host Configuration
 *
 * Booted by `objectstack dev` / `objectstack serve` (see `package.json`).
 *
 * ## Boot modes
 *
 * ### Local mode  (`OBJECTSTACK_CLOUD_URL` is unset)
 *
 * Single-project, offline-first.  No control-plane DB is required.
 * Required env vars:
 *   OBJECTSTACK_PROJECT_ID        — project identity (e.g. "proj_local")
 *   OBJECTSTACK_DATABASE_URL      — project business DB (file:./app.db, memory://mydb, libsql://…)
 *   OBJECTSTACK_DATABASE_DRIVER   — driver name: sqlite | memory | turso | postgres
 *   OBJECTSTACK_ARTIFACT_PATH     — path to compiled artifact (default: ./dist/objectstack.json)
 *   AUTH_SECRET                   — JWT signing secret (≥32 chars)
 *
 * ### Cloud mode  (`OBJECTSTACK_CLOUD_URL` is set)
 *
 * Multi-project, control-plane connected.
 * Required env vars:
 *   OBJECTSTACK_DATABASE_URL      — control-plane DB URL
 *   OBJECTSTACK_DATABASE_AUTH_TOKEN — optional, for libSQL/Turso URLs
 *   AUTH_SECRET / NEXT_PUBLIC_BASE_URL — same as local
 *
 * The control-plane driver URL accepts:
 *   - unset / `file:<path>`  → SQLite (better-sqlite3)  [default: .objectstack/data/control.db]
 *   - `libsql://…`           → libSQL / Turso
 *   - `http(s)://…`          → libSQL / sqld over HTTP
 */

import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import type * as Contracts from '@objectstack/spec/contracts';
import {
    type BasePluginsFactory,
    type AppBundleResolver,
    AppPlugin,
} from '@objectstack/runtime';
import { createControlPlanePlugins } from './server/control-plane-preset.js';
import { templateRegistry } from './server/templates/registry.js';

type IDataDriver = Contracts.IDataDriver;

// ── Discriminator ─────────────────────────────────────────────────────────────
const isLocalMode = !process.env.OBJECTSTACK_CLOUD_URL;

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

// ── LOCAL MODE ────────────────────────────────────────────────────────────────

const localProjectId = process.env.OBJECTSTACK_PROJECT_ID ?? 'proj_local';
const localArtifactPath = process.env.OBJECTSTACK_ARTIFACT_PATH
    ?? resolvePath(dirname(fileURLToPath(import.meta.url)), 'dist/objectstack.json');

async function buildLocalPlugins() {
    const { ObjectQLPlugin } = await import('@objectstack/objectql');
    const { MetadataPlugin } = await import('@objectstack/metadata');
    const { AuthPlugin } = await import('@objectstack/plugin-auth');
    const { DriverPlugin } = await import('@objectstack/runtime');

    // Load artifact JSON to register app bundle (objects, views, etc.) via AppPlugin.
    // AppPlugin.init() calls manifest.register() → ql.registerApp() which is the
    // correct pathway for objects to enter the ObjectQL schema registry.
    let artifactBundle: any = null;
    try {
        const raw = await readFile(localArtifactPath, 'utf8');
        const parsed = JSON.parse(raw);
        // Detect envelope vs bare ObjectStackDefinition
        artifactBundle = (parsed?.schemaVersion && parsed?.metadata !== undefined)
            ? parsed.metadata
            : parsed;
    } catch {
        // Artifact not available yet (e.g. first run before compile) — AppPlugin skipped.
    }

    // Build a database driver for local mode.
    // Defaults to SQLite at .objectstack/data/app.db if no env var is set.
    const dbUrl = process.env.OBJECTSTACK_DATABASE_URL?.trim()
        || `file:${resolvePath(dirname(fileURLToPath(import.meta.url)), '.objectstack/data/app.db')}`;
    const dbDriver = process.env.OBJECTSTACK_DATABASE_DRIVER?.trim() || 'sqlite';

    let driverPlugin: any;
    if (dbDriver === 'memory' || dbUrl.startsWith('memory://')) {
        const { InMemoryDriver: MemoryDriver } = await import('@objectstack/driver-memory');
        driverPlugin = new DriverPlugin(new MemoryDriver());
    } else {
        const { SqlDriver } = await import('@objectstack/driver-sql');
        const filename = dbUrl.replace(/^file:(\/\/)?/, '');
        const { mkdirSync } = await import('node:fs');
        mkdirSync(resolvePath(filename, '..'), { recursive: true });
        driverPlugin = new DriverPlugin(
            new SqlDriver({ client: 'better-sqlite3', connection: { filename }, useNullAsDefault: true }),
        );
    }

    // MetadataPlugin must start before ObjectQLPlugin so that when ObjectQL's
    // start() calls loadMetadataFromService(), the artifact is already loaded.
    const plugins: any[] = [
        driverPlugin,
        new MetadataPlugin({
            watch: false,
            environmentId: localProjectId,
            artifactSource: { mode: 'local-file', path: localArtifactPath },
        }),
        new ObjectQLPlugin({ environmentId: localProjectId }),
        new AuthPlugin({ secret: authSecret, baseUrl, plugins: { organization: true, twoFactor: false, passkeys: false, magicLink: false } }),
    ];

    if (artifactBundle) {
        plugins.push(new AppPlugin(artifactBundle));
    }

    return plugins;
}

// ── CLOUD MODE ────────────────────────────────────────────────────────────────

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

// Per-project kernels share a minimal base. Loaded lazily on project provisioning.
const basePlugins: BasePluginsFactory = async ({ projectId, project }) => {
    const { ObjectQLPlugin } = await import('@objectstack/objectql');
    const { MetadataPlugin } = await import('@objectstack/metadata');
    const { createTenantPlugin } = await import('@objectstack/service-tenant');
    const { AuthPlugin } = await import('@objectstack/plugin-auth');
    const { SecurityPlugin } = await import('@objectstack/plugin-security');
    const { AuditPlugin } = await import('@objectstack/plugin-audit');
    const orgId = project.organization_id;
    return [
        new ObjectQLPlugin({ environmentId: projectId }),
        new MetadataPlugin({ watch: false, environmentId: projectId, organizationId: orgId }),
        createTenantPlugin({ registerSystemObjects: true, registerLegacyTenantDatabase: false }),
        new AuthPlugin({ secret: authSecret, baseUrl }),
        new SecurityPlugin(),
        new AuditPlugin(),
    ];
};

const appBundles: AppBundleResolver = {
    async resolve() { return []; },
};

// Single shared promise — both control-plane plugins and MultiProjectPlugin
// use the same DB connection.
const controlDriverPromise = buildControlDriver();

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

// ── Export ────────────────────────────────────────────────────────────────────

const config = isLocalMode
    ? {
        plugins: await buildLocalPlugins(),
        api: {
            enableProjectScoping: false,
            projectResolution: 'none' as const,
        },
    }
    : {
        plugins: [
            ...createControlPlanePlugins({
                controlDriverPromise,
                authSecret,
                baseUrl,
            }),
            multiProjectPluginProxy,
        ],
        api: {
            enableProjectScoping: true,
            projectResolution: 'auto' as const,
        },
    };

export default config;
