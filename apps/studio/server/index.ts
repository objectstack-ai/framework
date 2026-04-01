// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Vercel Serverless API Entrypoint
 *
 * Boots the ObjectStack kernel lazily on the first request and delegates
 * all /api/* traffic to the ObjectStack Hono adapter.
 *
 * IMPORTANT: Vercel's Node.js runtime calls serverless functions with the
 * legacy `(IncomingMessage, ServerResponse)` signature — NOT the Web standard
 * `(Request) → Response` format.
 *
 * We use `handle()` from `@hono/node-server/vercel` which is the standard
 * Vercel adapter for Hono.  It internally uses `getRequestListener()` to
 * convert `IncomingMessage → Request` (including Vercel's pre-buffered
 * `rawBody`) and writes the `Response` back to `ServerResponse`.
 *
 * The outer Hono app delegates all requests to the inner ObjectStack Hono
 * app via `inner.fetch(c.req.raw)`, matching the pattern documented in
 * the ObjectStack deployment guide and validated by the hono adapter tests.
 *
 * All kernel/service initialisation is co-located here so there are no
 * extensionless relative module imports — which would break Node's ESM
 * resolver when deployed to Vercel (`"type": "module"` package).
 */

import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { TursoDriver } from '@objectstack/driver-turso';
import { createHonoApp } from '@objectstack/hono';
import { AuthPlugin } from '@objectstack/plugin-auth';
import { SecurityPlugin } from '@objectstack/plugin-security';
import { AuditPlugin } from '@objectstack/plugin-audit';
import { FeedServicePlugin } from '@objectstack/service-feed';
import { MetadataPlugin } from '@objectstack/metadata';
import { handle } from '@hono/node-server/vercel';
import { Hono } from 'hono';
import { createBrokerShim } from '../src/lib/create-broker-shim.js';
import studioConfig from '../objectstack.config.js';

// ---------------------------------------------------------------------------
// Singleton state — persists across warm Vercel invocations
// ---------------------------------------------------------------------------

let _kernel: ObjectKernel | null = null;
let _app: Hono | null = null;

/** Shared boot promise — prevents concurrent cold-start races. */
let _bootPromise: Promise<ObjectKernel> | null = null;

// ---------------------------------------------------------------------------
// Kernel bootstrap
// ---------------------------------------------------------------------------

/**
 * Boot the ObjectStack kernel (one-time cold-start cost).
 *
 * Uses a shared promise so that concurrent requests during a cold start
 * wait for the same boot sequence rather than starting duplicates.
 */
async function ensureKernel(): Promise<ObjectKernel> {
    if (_kernel) return _kernel;
    if (_bootPromise) return _bootPromise;

    _bootPromise = (async () => {
        console.log('[Vercel] Booting ObjectStack Kernel (server mode)...');

        try {
            const kernel = new ObjectKernel();

            await kernel.use(new ObjectQLPlugin());
            await kernel.use(new DriverPlugin(new TursoDriver({
                url: process.env.TURSO_DATABASE_URL ?? ':memory:',
                ...(process.env.TURSO_AUTH_TOKEN && { authToken: process.env.TURSO_AUTH_TOKEN }),
            }), 'turso'));
            await kernel.use(new AppPlugin(studioConfig));

            // Auth plugin — uses better-auth for real authentication
            // Prefer VERCEL_PROJECT_PRODUCTION_URL (stable across deployments)
            // over VERCEL_URL (unique per deployment, causes origin mismatch).
            const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
                ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
                : process.env.VERCEL_URL
                    ? `https://${process.env.VERCEL_URL}`
                    : 'http://localhost:3000';

            // Collect all Vercel URL variants so better-auth trusts each one
            const trustedOrigins: string[] = [];
            if (process.env.VERCEL_URL) {
                trustedOrigins.push(`https://${process.env.VERCEL_URL}`);
            }
            if (process.env.VERCEL_BRANCH_URL) {
                trustedOrigins.push(`https://${process.env.VERCEL_BRANCH_URL}`);
            }
            if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
                trustedOrigins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
            }

            await kernel.use(new AuthPlugin({
                secret: process.env.AUTH_SECRET || 'dev-secret-please-change-in-production-min-32-chars',
                baseUrl: vercelUrl,
                ...(trustedOrigins.length > 0 ? { trustedOrigins } : {}),
            }));

            await kernel.use(new SecurityPlugin());
            await kernel.use(new AuditPlugin());
            await kernel.use(new FeedServicePlugin());
            await kernel.use(new MetadataPlugin({ watch: false }));

            // Broker shim — bridges HttpDispatcher → ObjectQL engine
            (kernel as any).broker = createBrokerShim(kernel);

            await kernel.bootstrap();

            // Validate broker attachment
            if (!(kernel as any).broker) {
                console.warn('[Vercel] Broker shim lost during bootstrap — reattaching.');
                (kernel as any).broker = createBrokerShim(kernel);
            }

            // Seed data from config (non-fatal — the kernel is usable without seed data)
            try {
                await seedData(kernel, [studioConfig]);
            } catch (seedErr: any) {
                console.warn('[Vercel] Seed data failed (non-fatal):', seedErr?.message || seedErr);
            }

            _kernel = kernel;
            console.log('[Vercel] Kernel ready.');
            return kernel;
        } catch (err) {
            // Clear the lock so the next request can retry
            _bootPromise = null;
            console.error('[Vercel] Kernel boot failed:', (err as any)?.message || err);
            throw err;
        }
    })();

    return _bootPromise;
}

/**
 * Seed records defined in app configs into the ObjectQL engine.
 */
async function seedData(kernel: ObjectKernel, configs: any[]) {
    const ql = (kernel as any).context?.getService('objectql');
    if (!ql) return;

    const RESERVED_NS = new Set(['base', 'system']);
    const toFQN = (name: string, namespace?: string) => {
        if (name.includes('__') || !namespace || RESERVED_NS.has(namespace)) return name;
        return `${namespace}__${name}`;
    };

    for (const appConfig of configs) {
        const namespace = (appConfig.manifest || appConfig)?.namespace as string | undefined;

        const seedDatasets: any[] = [];
        if (Array.isArray(appConfig.data)) {
            seedDatasets.push(...appConfig.data);
        }
        if (appConfig.manifest && Array.isArray(appConfig.manifest.data)) {
            seedDatasets.push(...appConfig.manifest.data);
        }

        for (const dataset of seedDatasets) {
            if (!dataset.records || !dataset.object) continue;

            const objectFQN = toFQN(dataset.object, namespace);

            let existing = await ql.find(objectFQN);
            if (existing && (existing as any).value) existing = (existing as any).value;

            if (!existing || existing.length === 0) {
                console.log(`[Vercel] Seeding ${dataset.records.length} records for ${objectFQN}`);
                for (const record of dataset.records) {
                    await ql.insert(objectFQN, record);
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Hono app factory
// ---------------------------------------------------------------------------

/**
 * Get (or create) the Hono application backed by the ObjectStack kernel.
 * The prefix `/api/v1` matches the client SDK's default API path.
 */
async function ensureApp(): Promise<Hono> {
    if (_app) return _app;

    const kernel = await ensureKernel();
    _app = createHonoApp({ kernel, prefix: '/api/v1' });
    return _app;
}

// ---------------------------------------------------------------------------
// Vercel handler
// ---------------------------------------------------------------------------

/**
 * Outer Hono app — delegates all requests to the inner ObjectStack app.
 *
 * `handle()` from `@hono/node-server/vercel` wraps any Hono app and returns
 * the `(IncomingMessage, ServerResponse) => Promise<void>` signature that
 * Vercel's Node.js runtime expects for serverless functions.  Internally it
 * uses `getRequestListener()`, which already handles Vercel's pre-buffered
 * `rawBody` (Buffer) on the IncomingMessage for POST/PUT/PATCH requests.
 *
 * The outer→inner delegation pattern (`inner.fetch(c.req.raw)`) is the
 * standard ObjectStack Vercel deployment pattern documented in the deployment
 * guide and covered by the @objectstack/hono adapter test suite.
 */
const app = new Hono();

app.all('*', async (c) => {
    console.log(`[Vercel] ${c.req.method} ${c.req.url}`);

    try {
        const inner = await ensureApp();
        return await inner.fetch(c.req.raw);
    } catch (err: any) {
        console.error('[Vercel] Handler error:', err?.message || err);
        return c.json(
            {
                success: false,
                error: { message: err?.message || 'Internal Server Error', code: 500 },
            },
            500,
        );
    }
});

export default handle(app);

/**
 * Vercel per-function configuration.
 *
 * Picked up by the @vercel/node runtime from the deployed api/index.js bundle.
 * Replaces the top-level "functions" key in vercel.json so there is no
 * pre-build file-pattern validation against a not-yet-bundled artifact.
 */
export const config = {
    memory: 1024,
    maxDuration: 60,
};
