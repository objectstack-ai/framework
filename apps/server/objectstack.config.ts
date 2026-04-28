// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectStack Server — Host Configuration
 *
 * Booted by `objectstack dev` / `objectstack serve` (see `package.json`).
 *
 * ## Boot modes
 *
 * Selected via the `OBJECTSTACK_MODE` environment variable:
 *   - `standalone` (default)  — single-project, no control plane
 *   - `cloud`                 — multi-project, control plane + per-project DBs
 *
 * The legacy flag `OBJECTSTACK_MULTI_PROJECT=true` is still honoured as a
 * deprecated alias for `OBJECTSTACK_MODE=cloud` and will be removed in a
 * future major release.
 *
 * ### Standalone mode (`OBJECTSTACK_MODE` unset or `standalone`)
 *
 * Single-project, offline-first.  No control-plane DB is required.
 * Authentication is fully real — first-run users are walked through `/setup`
 * to create the owner account; thereafter every request requires a session.
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
 * ### Cloud mode (`OBJECTSTACK_MODE=cloud`)
 *
 * Multi-project, control-plane connected. See @objectstack/service-cloud for details.
 * Required env vars:
 *   OBJECTSTACK_DATABASE_URL      — control-plane DB URL
 *   OBJECTSTACK_DATABASE_AUTH_TOKEN — optional, for libSQL/Turso URLs
 *   AUTH_SECRET / NEXT_PUBLIC_BASE_URL — same as standalone
 */

import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { AppPlugin } from '@objectstack/runtime';
import { createCloudStack } from '@objectstack/service-cloud';
import { createSingleProjectPlugin } from './server/single-project-plugin.js';
import { templateRegistry } from './server/templates/registry.js';
import { createFsAppBundleResolver } from './server/fs-app-bundle-resolver.js';

function envFlag(name: string): boolean {
    return ['1', 'true', 'yes', 'on'].includes((process.env[name] ?? '').trim().toLowerCase());
}

/**
 * Resolve the deployment mode from environment.
 */
function resolveMode(): 'standalone' | 'cloud' {
    const raw = process.env.OBJECTSTACK_MODE?.trim().toLowerCase();
    if (raw === 'cloud' || raw === 'multi-project' /* legacy alias */) return 'cloud';
    if (raw === 'standalone' || raw === 'local' || raw === 'single-project') return 'standalone';
    if (raw && raw.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(`[objectstack] Unknown OBJECTSTACK_MODE=${raw}; falling back to "standalone".`);
    }
    if (envFlag('OBJECTSTACK_MULTI_PROJECT')) {
        // eslint-disable-next-line no-console
        console.warn(
            '[objectstack] OBJECTSTACK_MULTI_PROJECT is deprecated. Use `OBJECTSTACK_MODE=cloud` instead.',
        );
        return 'cloud';
    }
    return 'standalone';
}

// ── Boot mode ─────────────────────────────────────────────────────────────────
const mode = resolveMode();
const isStandaloneMode = mode === 'standalone';

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

// ── STANDALONE MODE ───────────────────────────────────────────────────────────

const localProjectId = process.env.OBJECTSTACK_PROJECT_ID ?? 'proj_local';
const localArtifactPath = process.env.OBJECTSTACK_ARTIFACT_PATH
    ?? resolvePath(dirname(fileURLToPath(import.meta.url)), 'dist/objectstack.json');

async function buildStandalonePlugins() {
    const { ObjectQLPlugin } = await import('@objectstack/objectql');
    const { MetadataPlugin } = await import('@objectstack/metadata');
    const { AuthPlugin } = await import('@objectstack/plugin-auth');
    const { DriverPlugin } = await import('@objectstack/runtime');

    let artifactBundle: any = null;
    try {
        const raw = await readFile(localArtifactPath, 'utf8');
        const parsed = JSON.parse(raw);
        artifactBundle = (parsed?.schemaVersion && parsed?.metadata !== undefined)
            ? parsed.metadata
            : parsed;
    } catch {
        // Artifact not available yet (e.g. first run before compile) — AppPlugin skipped.
    }

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

    const plugins: any[] = [
        driverPlugin,
        new MetadataPlugin({
            watch: false,
            environmentId: localProjectId,
            artifactSource: { mode: 'local-file', path: localArtifactPath },
        }),
        new ObjectQLPlugin({ environmentId: localProjectId }),
        new AuthPlugin({ secret: authSecret, baseUrl, plugins: { organization: true, twoFactor: true, passkeys: false, magicLink: false, oidcProvider: true, deviceAuthorization: true } }),
        createSingleProjectPlugin({ projectId: localProjectId }),
    ];

    if (artifactBundle) {
        plugins.push(new AppPlugin(artifactBundle));
    }

    return plugins;
}

// ── Export ────────────────────────────────────────────────────────────────────

const config = isStandaloneMode
    ? {
        plugins: await buildStandalonePlugins(),
        api: {
            enableProjectScoping: false,
            projectResolution: 'none' as const,
        },
    }
    : await createCloudStack({
        authSecret,
        baseUrl,
        templates: templateRegistry,
        appBundles: createFsAppBundleResolver(),
    });

export default config;
