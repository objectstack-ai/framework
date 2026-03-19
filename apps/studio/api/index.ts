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
 * We use `getRequestListener()` from `@hono/node-server` which properly
 * converts `IncomingMessage → Request`, calls our fetch callback, then writes
 * the `Response` back to `ServerResponse`.
 *
 * For POST/PUT/PATCH requests, Vercel pre-buffers the body on the
 * IncomingMessage as `rawBody` (Buffer) or `body` (parsed).  We extract it
 * directly and build a clean `Request` so the inner Hono app receives a
 * body it can `.json()` without depending on Node stream-to-ReadableStream
 * conversion (which can hang when the stream has already been consumed).
 *
 * All kernel/service initialisation is co-located here so there are no
 * extensionless relative module imports — which would break Node's ESM
 * resolver when deployed to Vercel (`"type": "module"` package).
 */

import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { createHonoApp } from '@objectstack/hono';
import { AuthPlugin } from '@objectstack/plugin-auth';
import { getRequestListener } from '@hono/node-server';
import type { Hono } from 'hono';
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

            // Auth plugin — uses better-auth for real authentication
            const vercelUrl = process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : 'http://localhost:3000';
            await kernel.use(new AuthPlugin({
                secret: process.env.AUTH_SECRET || 'dev-secret-please-change-in-production-min-32-chars',
                baseUrl: vercelUrl,
            }));

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
// Body extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract the request body from the Vercel IncomingMessage.
 *
 * Vercel's Node.js runtime pre-buffers the full request body and attaches it
 * to the IncomingMessage as `rawBody` (Buffer) and/or `body` (parsed).
 * Reading from these properties is synchronous and avoids the fragile
 * IncomingMessage → ReadableStream conversion that can hang when the
 * underlying Node stream has already been consumed.
 *
 * Returns `null` for GET/HEAD/OPTIONS or when no body is available.
 */
function extractBody(incoming: any, method: string, contentType: string | undefined): BodyInit | null {
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
        return null;
    }

    // 1. rawBody (Buffer or string) — most reliable, set by Vercel runtime
    if (incoming?.rawBody != null) {
        if (typeof incoming.rawBody === 'string') return incoming.rawBody;
        if (typeof incoming.rawBody.toString === 'function') return incoming.rawBody;
        return String(incoming.rawBody);
    }

    // 2. body (parsed by Vercel) — re-serialize based on content-type
    if (incoming?.body != null) {
        if (typeof incoming.body === 'string') return incoming.body;
        if (contentType?.includes('application/json')) return JSON.stringify(incoming.body);
        return String(incoming.body);
    }

    return null;
}

// ---------------------------------------------------------------------------
// Vercel handler
// ---------------------------------------------------------------------------

/**
 * `getRequestListener` from `@hono/node-server` converts
 * `IncomingMessage → Request`, calls our fetch callback, then writes the
 * `Response` back to `ServerResponse` (including `res.end()`).
 *
 * For requests with a body, we extract it from the IncomingMessage directly
 * (bypassing the Node stream → ReadableStream conversion) and create a new
 * Request that the inner Hono app can safely `.json()`.
 */
export default getRequestListener(async (request, env) => {
    const method = request.method;
    const url = request.url;

    console.log(`[Vercel] ${method} ${url}`);

    try {
        const app = await ensureApp();
        const incoming = (env as any)?.incoming;

        // For body methods, extract body from IncomingMessage and build a clean Request
        if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && incoming) {
            const contentType = incoming.headers?.['content-type'];
            const body = extractBody(incoming, method, contentType);

            if (body != null) {
                console.log(`[Vercel] Body extracted from IncomingMessage (${typeof body === 'string' ? body.length + ' chars' : 'Buffer'})`);
                const newReq = new Request(url, {
                    method,
                    headers: request.headers,
                    body,
                });
                return await app.fetch(newReq);
            }

            console.log('[Vercel] No rawBody/body on IncomingMessage — using proxy request');
        }

        return await app.fetch(request);
    } catch (err: any) {
        console.error('[Vercel] Handler error:', err?.message || err);
        return new Response(
            JSON.stringify({
                success: false,
                error: { message: err?.message || 'Internal Server Error', code: 500 },
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
});
