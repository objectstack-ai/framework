// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Vercel Serverless API Entrypoint
 *
 * Boots the ObjectStack kernel lazily on the first request and delegates
 * all /api/* traffic to the ObjectStack Hono adapter.
 *
 * Uses `getRequestListener()` from `@hono/node-server` together with an
 * `extractBody()` helper to handle Vercel's pre-buffered request body.
 * Vercel's Node.js runtime attaches the full body to `req.rawBody` /
 * `req.body` before the handler is called, so the original stream is
 * already drained when the handler receives the request. Reading from
 * `rawBody` / `body` directly and constructing a fresh `Request` object
 * prevents POST/PUT/PATCH requests from hanging indefinitely.
 *
 * This follows the proven pattern from the hotcrm reference deployment:
 * @see https://github.com/objectstack-ai/hotcrm/blob/main/api/%5B%5B...route%5D%5D.ts
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
import { SetupPlugin } from '@objectstack/plugin-setup';
import { FeedServicePlugin } from '@objectstack/service-feed';
import { MetadataPlugin } from '@objectstack/metadata';
import { AIServicePlugin } from '@objectstack/service-ai';
import { AutomationServicePlugin } from '@objectstack/service-automation';
import { AnalyticsServicePlugin } from '@objectstack/service-analytics';
import { getRequestListener } from '@hono/node-server';
import type { Hono } from 'hono';
import { createBrokerShim } from '../src/lib/create-broker-shim.js';
import studioConfig from '../objectstack.config.js';

// ---------------------------------------------------------------------------
// Vercel origin helpers
// ---------------------------------------------------------------------------

/**
 * Collect all Vercel deployment origins from environment variables.
 *
 * Reused for both:
 * - better-auth `trustedOrigins` (CSRF)
 * - Hono CORS middleware `origin` allowlist
 *
 * Centralised to avoid drift between the two allowlists.
 */
function getVercelOrigins(): string[] {
    const origins: string[] = [];
    if (process.env.VERCEL_URL) {
        origins.push(`https://${process.env.VERCEL_URL}`);
    }
    if (process.env.VERCEL_BRANCH_URL) {
        origins.push(`https://${process.env.VERCEL_BRANCH_URL}`);
    }
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
    }
    return origins;
}

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

            // Reuse the shared helper so CORS and CSRF allowlists stay in sync
            const trustedOrigins = getVercelOrigins();

            await kernel.use(new AuthPlugin({
                secret: process.env.AUTH_SECRET || 'dev-secret-please-change-in-production-min-32-chars',
                baseUrl: vercelUrl,
                ...(trustedOrigins.length > 0 ? { trustedOrigins } : {}),
            }));

            await kernel.use(new SecurityPlugin());
            await kernel.use(new AuditPlugin());
            await kernel.use(new FeedServicePlugin());
            await kernel.use(new MetadataPlugin({ watch: false }));
            await kernel.use(new AIServicePlugin());
            await kernel.use(new AutomationServicePlugin());
            await kernel.use(new AnalyticsServicePlugin());
            await kernel.use(new SetupPlugin());

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
// Body extraction — reads Vercel's pre-buffered request body.
//
// Vercel's Node.js runtime buffers the entire request body before invoking
// the serverless handler and attaches it to `IncomingMessage` as:
//   - `rawBody`  (Buffer | string) — the raw bytes
//   - `body`     (object | string) — parsed body (for JSON/form content types)
//
// The underlying readable stream is therefore already drained by the time
// our handler runs. Building a new `Request` from these pre-buffered
// properties avoids the indefinite hang that occurs when `req.json()` tries
// to read a consumed stream.
//
// @see https://github.com/objectstack-ai/hotcrm/blob/main/api/%5B%5B...route%5D%5D.ts
// ---------------------------------------------------------------------------

/** Shape of the Vercel-augmented IncomingMessage passed via `env.incoming`. */
interface VercelIncomingMessage {
    rawBody?: Buffer | string;
    body?: unknown;
    headers?: Record<string, string | string[] | undefined>;
}

/** Shape of the env object provided by `getRequestListener` on Vercel. */
interface VercelEnv {
    incoming?: VercelIncomingMessage;
}

function extractBody(
    incoming: VercelIncomingMessage,
    method: string,
    contentType: string | undefined,
): BodyInit | null {
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;

    if (incoming.rawBody != null) {
        return incoming.rawBody;
    }

    if (incoming.body != null) {
        if (typeof incoming.body === 'string') return incoming.body;
        if (contentType?.includes('application/json')) return JSON.stringify(incoming.body);
        return String(incoming.body);
    }

    return null;
}

/**
 * Derive the correct public URL for the request, fixing the protocol when
 * running behind a reverse proxy such as Vercel's edge network.
 *
 * `@hono/node-server`'s `getRequestListener` constructs the URL from
 * `incoming.socket.encrypted`, which is `false` on Vercel's internal network
 * even though the external request is HTTPS.  Using `x-forwarded-proto: https`
 * (set by Vercel's edge) ensures that better-auth sees an `https://` URL,
 * so cookie `Secure` attributes, callback URL validation, and any protocol
 * comparisons work correctly.
 */
function resolvePublicUrl(
    requestUrl: string,
    incoming: VercelIncomingMessage | undefined,
): string {
    if (!incoming) return requestUrl;
    const fwdProto = incoming.headers?.['x-forwarded-proto'];
    const rawProto = Array.isArray(fwdProto) ? fwdProto[0] : fwdProto;
    // Accept only well-known protocol values to prevent header-injection attacks.
    const proto = rawProto === 'https' || rawProto === 'http' ? rawProto : undefined;
    if (proto === 'https' && requestUrl.startsWith('http:')) {
        return requestUrl.replace(/^http:/, 'https:');
    }
    return requestUrl;
}

// ---------------------------------------------------------------------------
// Vercel Node.js serverless handler via @hono/node-server getRequestListener.
//
// Using getRequestListener() instead of handle() from @hono/node-server/vercel
// gives us access to the raw IncomingMessage via `env.incoming`, which lets us
// read Vercel's pre-buffered rawBody/body for POST/PUT/PATCH requests.
//
// This follows the proven pattern from the hotcrm reference deployment.
// ---------------------------------------------------------------------------

export default getRequestListener(async (request, env) => {
    let app: Hono;
    try {
        app = await ensureApp();
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Vercel] Handler error — bootstrap did not complete:', message);
        return new Response(
            JSON.stringify({
                success: false,
                error: {
                    message: 'Service Unavailable — kernel bootstrap failed.',
                    code: 503,
                },
            }),
            { status: 503, headers: { 'content-type': 'application/json' } },
        );
    }

    const method = request.method.toUpperCase();
    const incoming = (env as VercelEnv)?.incoming;

    // Fix URL protocol using x-forwarded-proto (Vercel sets this to 'https').
    const url = resolvePublicUrl(request.url, incoming);

    console.log(`[Vercel] ${method} ${url}`);

    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && incoming) {
        const contentType = incoming.headers?.['content-type'];
        const contentTypeStr = Array.isArray(contentType) ? contentType[0] : contentType;
        const body = extractBody(incoming, method, contentTypeStr);
        if (body != null) {
            return await app.fetch(
                new Request(url, { method, headers: request.headers, body }),
            );
        }
    }

    // For GET/HEAD/OPTIONS (or body-less requests): pass through with corrected URL.
    return await app.fetch(
        new Request(url, { method, headers: request.headers }),
    );
});

/**
 * Vercel per-function configuration.
 *
 * Picked up by the @vercel/node runtime from the deployed api/[[...route]].js bundle.
 * Replaces the top-level "functions" key in vercel.json so there is no
 * pre-build file-pattern validation against a not-yet-bundled artifact.
 */
export const config = {
    memory: 1024,
    maxDuration: 60,
};
