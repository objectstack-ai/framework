// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectStack Server — Host Configuration
 *
 * Booted by `objectstack dev` / `objectstack serve` (see `package.json`).
 *
 * ## Boot modes
 *
 * ### Single-project mode (`OBJECTSTACK_MULTI_PROJECT` is unset or false)
 *
 * Single-project, offline-first.  No control-plane DB is required.
 * Required env vars:
 *   OBJECTSTACK_PROJECT_ID        — project identity (e.g. "proj_local")
 *   OBJECTSTACK_DATABASE_URL      — project business DB (file:./app.db, memory://mydb, libsql://…, https://…)
 *   OBJECTSTACK_DATABASE_AUTH_TOKEN — optional auth token for libSQL/Turso URLs
 *   OBJECTSTACK_DATABASE_DRIVER   — driver name: sqlite | memory | turso (auto-detected from URL)
 *   OBJECTSTACK_ARTIFACT_PATH     — path to compiled artifact (default: ./dist/objectstack.json)
 *   AUTH_SECRET                   — JWT signing secret (≥32 chars)
 *
 * For Vercel / serverless deployments use a Turso database:
 *   TURSO_DATABASE_URL            — libsql:// or https:// Turso URL (fallback alias for OBJECTSTACK_DATABASE_URL)
 *   TURSO_AUTH_TOKEN              — Turso auth token (fallback alias for OBJECTSTACK_DATABASE_AUTH_TOKEN)
 *
 * ### Multi-project mode (`OBJECTSTACK_MULTI_PROJECT=true`)
 *
 * Multi-project, control-plane connected.
 * Required env vars:
 *   OBJECTSTACK_DATABASE_URL      — control-plane DB URL
 *   OBJECTSTACK_DATABASE_AUTH_TOKEN — optional, for libSQL/Turso URLs
 *   AUTH_SECRET / NEXT_PUBLIC_BASE_URL — same as local
 *
 * The control-plane driver URL accepts:
 *   - unset / `file:<path>`  → local SQLite (better-sqlite3)  [default: .objectstack/data/control.db]
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
import { createSingleProjectPlugin } from './server/single-project-plugin.js';
import { createStudioRuntimeConfigPlugin, createTemplatesRoutePlugin } from './server/multi-project-plugins.js';
import { listTemplates } from './server/templates/registry.js';
import { templateRegistry } from './server/templates/registry.js';
import { createFsAppBundleResolver } from './server/fs-app-bundle-resolver.js';

type IDataDriver = Contracts.IDataDriver;

function envFlag(name: string): boolean {
    return ['1', 'true', 'yes', 'on'].includes((process.env[name] ?? '').trim().toLowerCase());
}

// ── Boot mode ─────────────────────────────────────────────────────────────────
const isLocalMode = !envFlag('OBJECTSTACK_MULTI_PROJECT');

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
    // Defaults to SQLite at .objectstack/data/app.db relative to the server root.
    // For Vercel / serverless deployments, set OBJECTSTACK_DATABASE_URL to a
    // libsql:// or https:// Turso URL (and OBJECTSTACK_DATABASE_AUTH_TOKEN if needed).
    const serverDir = dirname(fileURLToPath(import.meta.url));
    const dbUrl = process.env.OBJECTSTACK_DATABASE_URL?.trim()
        || process.env.TURSO_DATABASE_URL?.trim()
        || `file:${resolvePath(serverDir, '.objectstack/data/app.db')}`;
    const dbAuthToken = process.env.OBJECTSTACK_DATABASE_AUTH_TOKEN?.trim()
        || process.env.TURSO_AUTH_TOKEN?.trim();
    const dbDriver = process.env.OBJECTSTACK_DATABASE_DRIVER?.trim()
        || (/^(libsql|https?):\/\//i.test(dbUrl) ? 'turso' : 'sqlite');

    let driverPlugin: any;
    if (dbDriver === 'memory' || dbUrl.startsWith('memory://')) {
        const { InMemoryDriver: MemoryDriver } = await import('@objectstack/driver-memory');
        driverPlugin = new DriverPlugin(new MemoryDriver());
    } else if (dbDriver === 'turso' || /^(libsql|https?):\/\//i.test(dbUrl)) {
        const { TursoDriver } = await import('@objectstack/driver-turso');
        driverPlugin = new DriverPlugin(new TursoDriver({ url: dbUrl, authToken: dbAuthToken }) as any);
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
        new AuthPlugin({ secret: authSecret, baseUrl, plugins: { organization: true, twoFactor: true, passkeys: false, magicLink: false, oidcProvider: true } }),
        // Short-circuits the control-plane endpoints Studio polls
        // (`/cloud/projects*`, `/auth/get-session`, `/auth/organization/list`)
        // and exposes `/studio/runtime-config` so the SPA can detect
        // single-project mode. Registered before DispatcherPlugin so these
        // routes win the match against the control-plane handlers.
        createSingleProjectPlugin({ projectId: localProjectId }),
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
        createTenantPlugin({ registerSystemObjects: true }),
        new AuthPlugin({ secret: authSecret, baseUrl }),
        new SecurityPlugin(),
        new AuditPlugin(),
    ];
};

const appBundles: AppBundleResolver = createFsAppBundleResolver();

// Single shared promise — both control-plane plugins and MultiProjectPlugin
// use the same DB connection.
const controlDriverPromise = buildControlDriver();

const multiProjectPluginProxy: any = {
    name: 'com.objectstack.multi-project',
    version: '0.0.0',
    _impl: null as any,
    async init(ctx: any) {
        try {
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
        } catch (err: any) {
            // Surface init failures explicitly. Without this, a Turso connection
            // error or service-registration crash silently leaves the kernel
            // running with no `template-seeder`, surfacing as `/cloud/templates`
            // returning `{ templates: [], total: 0 }` on Vercel/play.objectstack.ai.
            // eslint-disable-next-line no-console
            console.error('[multiProjectPluginProxy] init failed:', err?.stack ?? err?.message ?? err);
            // Do NOT rethrow: a partial init (e.g. driver registered but
            // service registration failed) is still better than crashing the
            // entire control plane. The logged error is the only diagnostic.
        }
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
            createStudioRuntimeConfigPlugin(),
            // Static /cloud/templates handler — registered on http.server
            // before DispatcherPlugin so it wins. The dispatcher's seeder-
            // based path is kept as a fallback for environments that bypass
            // this layer (e.g. tests using the dispatcher directly).
            createTemplatesRoutePlugin(listTemplates()),
        ],
        api: {
            enableProjectScoping: true,
            projectResolution: 'auto' as const,
        },
    };

export default config;
