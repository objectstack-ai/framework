// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Vercel Serverless API Entrypoint
 *
 * Boots the ObjectStack kernel from the shared `objectstack.config.ts`
 * and delegates all `/api/*` traffic to the Hono adapter. The same
 * `ensureApp()` / `ensureBoot()` singletons are reused by the E2E test
 * harness — local `pnpm dev` is served by the `objectstack dev` CLI and
 * does not import this file.
 */

import { createHonoApp } from '@objectstack/hono';
import { createOriginMatcher, hasWildcardPattern } from '@objectstack/plugin-hono-server';
import { getRequestListener } from '@hono/node-server';
import { ObjectKernel, createRestApiPlugin, createDispatcherPlugin, KernelManager } from '@objectstack/runtime';
import type { EnvironmentDriverRegistry } from '@objectstack/runtime';
import type { Hono } from 'hono';
import stackConfig from '../objectstack.config.js';

// ---------------------------------------------------------------------------
// Runtime shape returned by ensureBoot()
// ---------------------------------------------------------------------------

export interface BootResult {
    kernel: ObjectKernel;
    kernelManager: KernelManager;
    envRegistry: EnvironmentDriverRegistry;
}

// ---------------------------------------------------------------------------
// Singleton state — persists across warm Vercel invocations
// ---------------------------------------------------------------------------

let _boot: BootResult | null = null;
let _app: Hono | null = null;

/** Shared boot promise — prevents concurrent cold-start races. */
let _bootPromise: Promise<BootResult> | null = null;

async function bootKernel(): Promise<BootResult> {
    const kernel = new ObjectKernel();

    // 1. Config plugins (control-plane preset + MultiProjectPlugin)
    for (const plugin of stackConfig.plugins ?? []) {
        await kernel.use(plugin as any);
    }

    // 2. Optional SetupPlugin — provides the Studio's setup app. Same as
    //    the CLI's auto-register path; kept here so the serverless bundle
    //    is independently bootable.
    try {
        const setupPkg = '@objectstack/plugin-setup';
        const { SetupPlugin } = await import(/* webpackIgnore: true */ setupPkg);
        await kernel.use(new SetupPlugin());
    } catch {
        // optional
    }

    // 3. REST API + Dispatcher — consume the scoping config from stackConfig.api
    const api = (stackConfig as any).api ?? {};
    try {
        await kernel.use(
            createRestApiPlugin({ api: { api } } as any),
        );
    } catch { /* optional */ }
    try {
        await kernel.use(
            createDispatcherPlugin({ scoping: api }),
        );
    } catch { /* optional */ }

    await kernel.bootstrap();

    const envRegistry = (kernel as any).getService('env-registry') as EnvironmentDriverRegistry;
    const kernelManager = (kernel as any).getService('kernel-manager') as KernelManager;

    return { kernel, kernelManager, envRegistry };
}

async function ensureBoot(): Promise<BootResult> {
    if (_boot) return _boot;
    if (_bootPromise) return _bootPromise;

    _bootPromise = (async () => {
        console.log('[ObjectStack] Booting kernel...');
        try {
            const result = await bootKernel();
            _boot = result;
            console.log('[ObjectStack] Kernel ready.');
            return result;
        } catch (err) {
            _bootPromise = null;
            console.error('[ObjectStack] Kernel boot failed:', (err as any)?.message || err);
            throw err;
        }
    })();

    return _bootPromise;
}

// ---------------------------------------------------------------------------
// Hono app factory
// ---------------------------------------------------------------------------

async function ensureApp(): Promise<Hono> {
    if (_app) return _app;

    const { kernel } = await ensureBoot();
    // envRegistry / kernelManager are resolved by HttpDispatcher from the
    // kernel's service registry (MultiProjectPlugin registered them during
    // bootKernel), so they do NOT need to be passed explicitly here.
    _app = createHonoApp({ kernel, prefix: '/api/v1' });
    return _app;
}

export { ensureApp, ensureBoot };

// ---------------------------------------------------------------------------
// CORS headers — applied to responses that bypass the Hono app
// (bootstrap failures, preflight short-circuit). Mirrors the defaults of
// `createHonoApp()` so behaviour is identical whether or not the kernel
// has finished booting. See packages/adapters/hono/src/index.ts.
//
// Controlled by the same environment variables as the Hono adapter:
//   CORS_ENABLED, CORS_ORIGIN, CORS_CREDENTIALS, CORS_MAX_AGE.
// ---------------------------------------------------------------------------

const CORS_ALLOW_METHODS = 'GET,POST,PUT,DELETE,PATCH,HEAD,OPTIONS';
const CORS_ALLOW_HEADERS = 'Content-Type,Authorization,X-Requested-With';

function corsEnabled(): boolean {
    return process.env.CORS_ENABLED !== 'false';
}

function corsCredentials(): boolean {
    return process.env.CORS_CREDENTIALS !== 'false';
}

function corsMaxAge(): number {
    return process.env.CORS_MAX_AGE ? parseInt(process.env.CORS_MAX_AGE, 10) : 86400;
}

function originMatches(pattern: string, origin: string): boolean {
    if (pattern === origin) return true;
    if (!pattern.includes('*')) return false;
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`).test(origin);
}

function resolveAllowOrigin(requestOrigin: string | null): string | null {
    const credentials = corsCredentials();
    const envOrigin = process.env.CORS_ORIGIN?.trim();

    if (!envOrigin) {
        if (requestOrigin) return requestOrigin;
        return credentials ? null : '*';
    }

    if (envOrigin === '*') {
        if (credentials) return requestOrigin || null;
        return '*';
    }

    if (hasWildcardPattern(envOrigin)) {
        if (!requestOrigin) return null;
        return createOriginMatcher(envOrigin)(requestOrigin);
    }

    const allowed = envOrigin.includes(',')
        ? envOrigin.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [envOrigin];

    if (requestOrigin && allowed.some(pattern => originMatches(pattern, requestOrigin))) return requestOrigin;
    if (allowed.length === 1 && !requestOrigin) return allowed[0];
    return null;
}

function withCorsHeaders(response: Response, request: Request): Response {
    if (!corsEnabled()) return response;

    const requestOrigin = request.headers.get('origin');
    const allowOrigin = resolveAllowOrigin(requestOrigin);
    if (!allowOrigin) return response;

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', allowOrigin);
    if (corsCredentials()) {
        headers.set('Access-Control-Allow-Credentials', 'true');
    }
    const existingVary = headers.get('Vary');
    if (!existingVary) {
        headers.set('Vary', 'Origin');
    } else if (!/(^|,\s*)Origin(\s*,|$)/i.test(existingVary)) {
        headers.set('Vary', `${existingVary}, Origin`);
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

function buildPreflightResponse(request: Request): Response {
    const requestOrigin = request.headers.get('origin');
    const allowOrigin = resolveAllowOrigin(requestOrigin);

    if (!allowOrigin) {
        return new Response(null, { status: 204 });
    }

    const requestedHeaders = request.headers.get('access-control-request-headers');
    const headers = new Headers({
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
        'Access-Control-Allow-Headers': requestedHeaders || CORS_ALLOW_HEADERS,
        'Access-Control-Max-Age': String(corsMaxAge()),
        Vary: 'Origin, Access-Control-Request-Headers',
    });
    if (corsCredentials()) {
        headers.set('Access-Control-Allow-Credentials', 'true');
    }
    return new Response(null, { status: 204, headers });
}

// ---------------------------------------------------------------------------
// Body extraction — reads Vercel's pre-buffered request body.
// ---------------------------------------------------------------------------

interface VercelIncomingMessage {
    rawBody?: Buffer | string;
    body?: unknown;
    headers?: Record<string, string | string[] | undefined>;
}

interface VercelEnv {
    incoming?: VercelIncomingMessage;
}

function extractBody(
    incoming: VercelIncomingMessage,
    method: string,
    contentType: string | undefined,
): any {
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

function resolvePublicUrl(
    requestUrl: string,
    incoming: VercelIncomingMessage | undefined,
): string {
    if (!incoming) return requestUrl;
    const fwdProto = incoming.headers?.['x-forwarded-proto'];
    const rawProto = Array.isArray(fwdProto) ? fwdProto[0] : fwdProto;
    const proto = rawProto === 'https' || rawProto === 'http' ? rawProto : undefined;
    if (proto === 'https' && requestUrl.startsWith('http:')) {
        return requestUrl.replace(/^http:/, 'https:');
    }
    return requestUrl;
}

// ---------------------------------------------------------------------------
// Vercel Node.js serverless handler
// ---------------------------------------------------------------------------

export default getRequestListener(async (request, env) => {
    const method = request.method.toUpperCase();
    const incoming = (env as VercelEnv)?.incoming;
    const url = resolvePublicUrl(request.url, incoming);

    if (method === 'OPTIONS') {
        console.log(`[Vercel] OPTIONS ${url} (preflight short-circuit)`);
        return buildPreflightResponse(request);
    }

    let app: Hono;
    try {
        app = await ensureApp();
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Vercel] Handler error — bootstrap did not complete:', message);
        const errorResponse = new Response(
            JSON.stringify({
                success: false,
                error: {
                    message: 'Service Unavailable — kernel bootstrap failed.',
                    code: 503,
                },
            }),
            { status: 503, headers: { 'content-type': 'application/json' } },
        );
        return withCorsHeaders(errorResponse, request);
    }

    console.log(`[Vercel] ${method} ${url}`);

    if (method !== 'GET' && method !== 'HEAD' && incoming) {
        const contentType = incoming.headers?.['content-type'];
        const contentTypeStr = Array.isArray(contentType) ? contentType[0] : contentType;
        const body = extractBody(incoming, method, contentTypeStr);
        if (body != null) {
            return await app.fetch(
                new Request(url, { method, headers: request.headers, body }),
            );
        }
    }

    return await app.fetch(
        new Request(url, { method, headers: request.headers }),
    );
});

export const config = {
    maxDuration: 60,
};
