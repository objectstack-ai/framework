// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Vercel Serverless API Entrypoint
 *
 * Boots the ObjectStack kernel lazily on the first request and delegates
 * all /api/* traffic to the ObjectStack Hono adapter.
 *
 * IMPORTANT: Vercel's Node.js runtime calls serverless functions with the
 * legacy `(IncomingMessage, ServerResponse)` signature — NOT the Web standard
 * `(Request) → Response` format.  Using `handle()` from `hono/vercel` (Edge
 * adapter) would return a `Response` that nobody reads, while `res.end()` is
 * never called, causing a 300-second timeout.
 *
 * We use `handle()` from `@hono/node-server/vercel` instead, which properly
 * converts `IncomingMessage → Request`, calls `app.fetch()`, then writes the
 * `Response` back to `ServerResponse`.
 *
 * All kernel/service initialisation is co-located here so there are no
 * extensionless relative module imports — which would break Node's ESM
 * resolver when deployed to Vercel (`"type": "module"` package).
 */

import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { createHonoApp } from '@objectstack/hono';
import { Hono } from 'hono';
import { handle } from '@hono/node-server/vercel';
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
            await kernel.use(new DriverPlugin(new InMemoryDriver(), 'memory'));
            await kernel.use(new AppPlugin(studioConfig));

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

const app = new Hono();

/**
 * Delegate every request to the lazily-initialized ObjectStack Hono app.
 * `ensureApp()` boots the kernel on the first invocation (cold start)
 * and returns the cached instance on subsequent warm invocations.
 */
app.all('*', async (c) => {
    try {
        const inner = await ensureApp();
        return await inner.fetch(c.req.raw);
    } catch (err: any) {
        console.error('[Vercel] Handler error:', err?.message || err);
        return c.json(
            { success: false, error: { message: err?.message || 'Internal Server Error', code: 500 } },
            500,
        );
    }
});

/**
 * `handle()` from `@hono/node-server/vercel` returns an
 * `async (IncomingMessage, ServerResponse) => void` handler that:
 *   1. Converts IncomingMessage → standard Request
 *   2. Calls app.fetch(request)
 *   3. Writes the Response back to ServerResponse (including res.end())
 */
export default handle(app);

