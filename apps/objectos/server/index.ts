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
import { createOriginMatcher, hasWildcardPattern, HonoHttpServer } from '@objectstack/plugin-hono-server';
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
    kernelManager?: KernelManager;
    envRegistry?: EnvironmentDriverRegistry;
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

    // 0. Register an `http.server` (IHttpServer) adapter BEFORE plugins so
    //    that any plugin's start() hook can resolve `ctx.getService('http.server')`
    //    and register routes on it. This is the official ObjectStack
    //    protocol for plugin-supplied HTTP routes (see IHttpServer in
    //    @objectstack/spec/contracts and HonoServerPlugin's reference
    //    implementation). The Vercel entrypoint cannot use HonoServerPlugin
    //    itself because we don't want plugin-hono-server to call listen() —
    //    Vercel hands us a request directly. Reusing the same adapter class
    //    keeps route-registration semantics identical between local
    //    (`objectstack dev`) and serverless deployments.
    const httpServer = new HonoHttpServer();
    kernel.registerService('http.server', httpServer);
    kernel.registerService('http-server', httpServer); // alias for backward compatibility

    // Unknown-environment hostname guard.
    //
    // In multi-tenant cloud deployments (objectos.app), every public
    // hostname is expected to map to a `sys_environment` row whose
    // hostname column matches the request `Host`. Without this guard,
    // an unknown subdomain like `demo-xxx.objectos.app` happily renders
    // the control-plane console (because the console SPA is served
    // statically and ignores the host), making the deployment look like
    // it has data when it doesn't. We respond with a clear 404 instead.
    //
    // Activation: only when OS_ROOT_DOMAIN is set (e.g. "objectos.app").
    // Reserved subdomains (cloud/www/api/docs/admin) bypass the check so
    // the platform's own surfaces and infra endpoints keep working.
    // Custom domains that aren't subdomains of the root are passed
    // through unchanged — a tenant's bring-your-own-domain still needs
    // to be looked up via envRegistry, but a miss there falls back to
    // the legacy behaviour to avoid blocking unknown-yet-valid hosts.
    const rootDomain = (process.env.OS_ROOT_DOMAIN || '').trim().toLowerCase();
    if (rootDomain) {
        const RESERVED = new Set(['', 'cloud', 'www', 'api', 'docs', 'admin', 'app']);
        const rawApp = httpServer.getRawApp();
        let envRegistryRef: any;
        const getEnvRegistry = async () => {
            if (envRegistryRef !== undefined) return envRegistryRef;
            try {
                envRegistryRef = await (kernel as any).getServiceAsync?.('env-registry') ?? null;
            } catch {
                envRegistryRef = null;
            }
            return envRegistryRef;
        };
        rawApp.use('*', async (c: any, next: any) => {
            const rawHost = c.req.header('host') || '';
            const host = rawHost.split(':')[0].toLowerCase();
            if (!host) return next();
            const isPlatformHost = host === rootDomain || host.endsWith('.' + rootDomain);
            if (!isPlatformHost) return next();
            const sub = host === rootDomain ? '' : host.slice(0, -(rootDomain.length + 1));
            // Treat any reserved subdomain (and apex) as platform infra,
            // not a tenant env. Also allow nested platform prefixes like
            // `api.cloud.objectos.app`.
            const head = sub.split('.').pop() || '';
            if (RESERVED.has(sub) || RESERVED.has(head)) return next();
            // Always allow platform-level infra endpoints regardless of host.
            const p = c.req.path;
            if (p.startsWith('/_admin/') || p === '/_admin' || p.startsWith('/.well-known/')) {
                return next();
            }
            const registry = await getEnvRegistry();
            if (!registry || typeof registry.resolveByHostname !== 'function') {
                // Registry unavailable — don't synthesize a 404 (could be
                // a boot-time race or a non-cloud deployment).
                return next();
            }
            try {
                const hit = await registry.resolveByHostname(host);
                if (hit) return next();
            } catch {
                return next();
            }
            return c.json(
                {
                    error: 'environment_not_found',
                    message: `No environment is bound to hostname '${host}'.`,
                    hostname: host,
                },
                404,
            );
        });
    }

    // 1. Config plugins (control-plane preset + MultiProjectPlugin + Auth/Security/Audit).
    //    AuthPlugin registers the platform Setup App via its manifest
    //    (definition lives in @objectstack/platform-objects/apps).
    for (const plugin of stackConfig.plugins ?? []) {
        await kernel.use(plugin as any);
    }

    // 2. REST API + Dispatcher — consume the scoping config from stackConfig.api
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

    const getOptionalService = async <T>(name: string): Promise<T | undefined> => {
        try { return await (kernel as any).getServiceAsync(name) as T; } catch { return undefined; }
    };
    const envRegistry = await getOptionalService<EnvironmentDriverRegistry>('env-registry');
    const kernelManager = await getOptionalService<KernelManager>('kernel-manager');

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

    // Plugins have already registered their routes onto the IHttpServer
    // (HonoHttpServer) we created in bootKernel(). Pull out its underlying
    // Hono so those plugin routes are matched FIRST, then mount the
    // dispatcher app underneath via `outer.route('/', inner)` — Hono uses
    // registration-order priority, so the plugin routes win the match
    // against the dispatcher's catch-all `/api/v1/*` handler.
    const httpServer = kernel.getService<HonoHttpServer>('http.server');
    const outer = httpServer.getRawApp();

    const inner = createHonoApp({ kernel, prefix: '/api/v1' });
    outer.route('/', inner);

    _app = outer;
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
            const response = await app.fetch(
                new Request(url, { method, headers: request.headers, body }),
            );
            return withCorsHeaders(response, request);
        }
    }

    const response = await app.fetch(
        new Request(url, { method, headers: request.headers }),
    );
    return withCorsHeaders(response, request);
});

export const config = {
    maxDuration: 60,
};
