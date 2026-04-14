// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Vercel Serverless API Entrypoint for App Host Example
 *
 * Boots the ObjectStack kernel lazily on the first request and delegates
 * all /api/* traffic to the ObjectStack Hono adapter.
 *
 * Uses `getRequestListener()` from `@hono/node-server` to handle Vercel's
 * pre-buffered request body properly.
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
import { createBrokerShim } from '../lib/create-broker-shim.js';
import CrmApp from '@example/app-crm';
import TodoApp from '@example/app-todo';
import BiPluginManifest from '@example/plugin-bi';

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
        console.log('[Vercel] Booting ObjectStack Kernel (app-host)...');

        try {
            const kernel = new ObjectKernel();

            // Register ObjectQL engine
            await kernel.use(new ObjectQLPlugin());

            // Database driver - Turso (remote mode for Vercel)
            const tursoUrl = process.env.TURSO_DATABASE_URL;
            const tursoToken = process.env.TURSO_AUTH_TOKEN;

            if (!tursoUrl || !tursoToken) {
                throw new Error('Missing required environment variables: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
            }

            const tursoDriver = new TursoDriver({
                url: tursoUrl,
                authToken: tursoToken,
                // Remote mode - no local sync needed for Vercel
            });

            await kernel.use(new DriverPlugin(tursoDriver));

            // Load app manifests (BEFORE plugins that need object schemas)
            await kernel.use(new AppPlugin(CrmApp));
            await kernel.use(new AppPlugin(TodoApp));
            await kernel.use(new AppPlugin(BiPluginManifest));

            // SetupPlugin must load BEFORE other plugins that contribute navigation items
            // so that the setupNav service is available during their init() phase
            await kernel.use(new SetupPlugin());

            // Auth plugin — uses environment variables for configuration
            // Prefer VERCEL_PROJECT_PRODUCTION_URL (stable across deployments)
            // over VERCEL_URL (unique per deployment, causes origin mismatch).
            const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
                ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
                : process.env.VERCEL_URL
                    ? `https://${process.env.VERCEL_URL}`
                    : 'http://localhost:3000';

            await kernel.use(new AuthPlugin({
                secret: process.env.AUTH_SECRET || 'dev-secret-please-change-in-production-min-32-chars',
                baseUrl: vercelUrl,
            }));

            // Register all kernel plugins (matching studio configuration)
            await kernel.use(new SecurityPlugin());
            await kernel.use(new AuditPlugin());
            await kernel.use(new FeedServicePlugin());
            await kernel.use(new MetadataPlugin({ watch: false }));
            await kernel.use(new AIServicePlugin());
            await kernel.use(new AutomationServicePlugin());
            await kernel.use(new AnalyticsServicePlugin());

            // Broker shim — bridges HttpDispatcher → ObjectQL engine
            (kernel as any).broker = createBrokerShim(kernel);

            await kernel.bootstrap();

            // Validate broker attachment
            if (!(kernel as any).broker) {
                console.warn('[Vercel] Broker shim lost during bootstrap — reattaching.');
                (kernel as any).broker = createBrokerShim(kernel);
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
 */
export const config = {
    memory: 1024,
    maxDuration: 60,
};
