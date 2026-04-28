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
import { createTenantPlugin } from '@objectstack/service-tenant';
import { MetadataPlugin } from '@objectstack/metadata';
import { AIServicePlugin } from '@objectstack/service-ai';
import { AutomationServicePlugin } from '@objectstack/service-automation';
import { AnalyticsServicePlugin } from '@objectstack/service-analytics';
import { getRequestListener } from '@hono/node-server';
import { Hono } from 'hono';
import studioConfig from '../objectstack.config.js';

/**
 * Parse a boolean env var with the same semantics as
 * `apps/server/objectstack.config.ts:envFlag` — we intentionally inline
 * rather than import across apps so each app stays self-contained.
 */
function envFlag(name: string): boolean {
    const raw = process.env[name];
    if (raw == null) return false;
    return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

const DEFAULT_LOCAL_ORG_ID = 'org_local';
const DEFAULT_LOCAL_PROJECT_ID = 'proj_local';
const DEFAULT_LOCAL_USER_ID = 'user_local';

/**
 * Is the server running in standalone (single-project) mode?
 *
 * Reads `OBJECTSTACK_MODE` (primary) with fallback to the deprecated
 * `OBJECTSTACK_MULTI_PROJECT` flag for backwards compatibility. When the
 * server is not in cloud mode, Studio synthesises a single virtual
 * `org_local`/`proj_local` so the frontend can keep its uniform
 * `/projects/:projectId/...` routing without a control plane.
 */
function isSingleProjectMode(): boolean {
    const mode = process.env.OBJECTSTACK_MODE?.trim().toLowerCase();
    if (mode === 'cloud' || mode === 'multi-project') return false;
    if (mode === 'standalone' || mode === 'local' || mode === 'single-project') return true;
    // Legacy fallback: honour the old `OBJECTSTACK_MULTI_PROJECT=true` flag.
    return !envFlag('OBJECTSTACK_MULTI_PROJECT');
}

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

            // SetupPlugin must load BEFORE other plugins that contribute navigation items
            // so that the setupNav service is available during their init() phase
            await kernel.use(new SetupPlugin());

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

            // Build social providers from environment variables
            const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
            if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
                socialProviders.google = { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET };
            }
            if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
                socialProviders.github = { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET };
            }
            if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
                socialProviders.microsoft = { clientId: process.env.MICROSOFT_CLIENT_ID, clientSecret: process.env.MICROSOFT_CLIENT_SECRET };
            }

            await kernel.use(new AuthPlugin({
                secret: process.env.AUTH_SECRET || 'dev-secret-please-change-in-production-min-32-chars',
                baseUrl: vercelUrl,
                ...(trustedOrigins.length > 0 ? { trustedOrigins } : {}),
                ...(Object.keys(socialProviders).length > 0 ? { socialProviders } : {}),
            }));

            await kernel.use(new SecurityPlugin());
            await kernel.use(new AuditPlugin());
            await kernel.use(new FeedServicePlugin());
            await kernel.use(createTenantPlugin({ registerSystemObjects: true }));
            await kernel.use(new MetadataPlugin({ watch: false }));
            await kernel.use(new AIServicePlugin());
            await kernel.use(new AutomationServicePlugin());
            await kernel.use(new AnalyticsServicePlugin());

            await kernel.bootstrap();

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

    // Object names in datasets are canonical short names — the registry stores
    // objects by short name; namespace disambiguation is internal to the registry.
    for (const appConfig of configs) {
        const seedDatasets: any[] = [];
        if (Array.isArray(appConfig.data)) {
            seedDatasets.push(...appConfig.data);
        }
        if (appConfig.manifest && Array.isArray(appConfig.manifest.data)) {
            seedDatasets.push(...appConfig.manifest.data);
        }

        for (const dataset of seedDatasets) {
            if (!dataset.records || !dataset.object) continue;

            const objectName = dataset.object;

            let existing = await ql.find(objectName);
            if (existing && (existing as any).value) existing = (existing as any).value;

            if (!existing || existing.length === 0) {
                console.log(`[Vercel] Seeding ${dataset.records.length} records for ${objectName}`);
                for (const record of dataset.records) {
                    await ql.insert(objectName, record);
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
 *
 * When the server is in standalone mode (`OBJECTSTACK_MODE` unset or
 * `standalone`) we wrap the kernel app in a thin outer router that
 * exposes `/api/v1/studio/runtime-config` so the SPA can detect
 * single-project mode on boot, plus a synthetic `/cloud/projects[/:id]`
 * row shaped to satisfy `packages/client` and `useProjects`.
 */
async function ensureApp(): Promise<Hono> {
    if (_app) return _app;

    const kernel = await ensureKernel();
    const innerApp = createHonoApp({ kernel, prefix: '/api/v1' });

    if (!isSingleProjectMode()) {
        _app = innerApp;
        return _app;
    }

    const outerApp = new Hono();
    registerSingleProjectRoutes(outerApp);
    outerApp.route('/', innerApp);
    _app = outerApp;
    return _app;
}

/**
 * Register the runtime-config endpoint plus synthetic control-plane
 * responses used in single-project mode. Kept in one place so the shape
 * changes co-locate with the helpers that produce them.
 *
 * Note: standalone (single-project) mode does NOT mock `/api/v1/auth/*`.
 * Authentication is real — every request flows through plugin-auth and
 * better-auth. Unauthenticated visitors are redirected to the Account
 * SPA's login (or `/setup` on first run).
 */
function registerSingleProjectRoutes(app: Hono): void {
    app.get('/api/v1/studio/runtime-config', (c) =>
        c.json({
            singleProject: true,
            defaultOrgId: DEFAULT_LOCAL_ORG_ID,
            defaultProjectId: DEFAULT_LOCAL_PROJECT_ID,
        }),
    );

    // Control-plane projects API — dispatcher-plugin shape
    // (`{ success, data: { projects, total }, meta }`). One synthetic
    // record is enough: the frontend derives `:projectId` from config.
    app.get('/api/v1/cloud/projects', (c) =>
        c.json({
            success: true,
            data: {
                projects: [buildLocalProjectRow()],
                total: 1,
            },
        }),
    );

    app.get('/api/v1/cloud/projects/:id', (c) => {
        const id = c.req.param('id');
        if (id !== DEFAULT_LOCAL_PROJECT_ID) {
            return c.json(
                {
                    success: false,
                    error: { code: 404, message: `Project ${id} not found` },
                },
                404,
            );
        }
        return c.json({
            success: true,
            data: {
                project: buildLocalProjectRow(),
                organization: { id: DEFAULT_LOCAL_ORG_ID, name: 'Local' },
            },
        });
    });
}

/**
 * Canonical shape of the synthesized local project. Matches `ProjectRow`
 * in `apps/studio/src/hooks/useProjects.ts` and the dispatcher's
 * snake_case convention.
 */
function buildLocalProjectRow(): Record<string, unknown> {
    const now = new Date().toISOString();
    return {
        id: DEFAULT_LOCAL_PROJECT_ID,
        organization_id: DEFAULT_LOCAL_ORG_ID,
        display_name: 'Local',
        is_default: true,
        is_system: false,
        status: 'active',
        created_by: DEFAULT_LOCAL_USER_ID,
        created_at: now,
        updated_at: now,
        metadata: {},
    };
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
