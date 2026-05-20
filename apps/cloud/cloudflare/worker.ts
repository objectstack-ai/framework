// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Cloudflare Containers entrypoint for ObjectStack Cloud.
 *
 * The Worker fronts a Container-class Durable Object that runs the
 * Node.js image built from `apps/cloud/Dockerfile`. All HTTP traffic is
 * forwarded 1:1 to the container on port 4000.
 *
 * Deploy with:
 *   wrangler deploy --config apps/cloud/wrangler.toml
 *
 * See `apps/cloud/wrangler.toml` for the full deployment workflow
 * (build + push image, then deploy Worker).
 */

import { Container, getContainer } from '@cloudflare/containers';

export interface Env {
    CLOUD: DurableObjectNamespace<CloudContainer>;
    // ── Secrets / vars forwarded to the Container process ────────────────
    // Set via `wrangler secret put X` or `[vars]` in wrangler.toml.
    // Anything declared here gets propagated into Container envVars in the
    // constructor below (undefined values are dropped). Keep this list in
    // sync with `FORWARDED_ENV_KEYS` further down.

    // — Database (tenant / control plane) —
    OS_DATABASE_URL?: string;
    OS_DATABASE_AUTH_TOKEN?: string;
    OS_DATABASE_DRIVER?: string;
    OS_CONTROL_DATABASE_URL?: string;
    OS_CONTROL_DATABASE_AUTH_TOKEN?: string;
    OS_CONTROL_PG_POOL_MIN?: string;
    OS_CONTROL_PG_POOL_MAX?: string;
    TURSO_DATABASE_URL?: string;
    TURSO_AUTH_TOKEN?: string;
    // Used by ProjectProvisioning's Turso adapter to create per-project DBs.
    TURSO_API_TOKEN?: string;
    TURSO_ORG_NAME?: string;

    // — Auth (better-auth) —
    AUTH_SECRET?: string;
    OS_AUTH_SECRET?: string;
    AUTH_BASE_URL?: string;
    OS_BASE_URL?: string;
    OS_TRUSTED_ORIGINS?: string;
    OS_COOKIE_DOMAIN?: string;
    OS_ROOT_DOMAIN?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;

    // — Cloud / multi-tenant —
    OS_PROJECT_ID?: string;
    OS_ORG_ID?: string;
    OS_CLOUD_URL?: string;
    OS_CLOUD_API_KEY?: string;
    OS_MULTI_TENANT?: string;

    // — Artifact / project —
    OS_PROJECT_ARTIFACT_ROOT?: string;
    OS_ARTIFACT_PATH?: string;
    OS_ARTIFACT_CACHE_TTL_MS?: string;
    OS_ARTIFACT_FETCH_TIMEOUT_MS?: string;
    OS_DATA_DIR?: string;
    OS_PROVISION_SYNC?: string;
    OS_EAGER_SCHEMAS?: string;
    OS_SKIP_SCHEMA_SYNC?: string;

    // — Storage (S3/R2) —
    OS_STORAGE_ADAPTER?: string;
    OS_STORAGE_LOCAL_DIR?: string;
    OS_S3_BUCKET?: string;
    OS_S3_REGION?: string;
    OS_S3_ENDPOINT?: string;
    OS_S3_ACCESS_KEY_ID?: string;
    OS_S3_SECRET_ACCESS_KEY?: string;
    OS_S3_FORCE_PATH_STYLE?: string;

    // — Preview —
    OS_PREVIEW_MODE?: string;
    OS_PREVIEW_BASE_DOMAINS?: string;

    // — Performance / cache (override defaults below) —
    OS_KERNEL_CACHE_SIZE?: string;
    OS_KERNEL_TTL_MS?: string;
    OS_ENV_CACHE_TTL_MS?: string;

    // — AI providers (when AI plugin is enabled) —
    OPENAI_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    GOOGLE_GENERATIVE_AI_API_KEY?: string;
    AI_MODEL?: string;
    AI_GATEWAY_MODEL?: string;

    // — MCP server —
    MCP_SERVER_ENABLED?: string;
    MCP_SERVER_NAME?: string;
    MCP_SERVER_TRANSPORT?: string;

    // — Misc —
    WEBHOOK_SECRET?: string;
}

/**
 * Whitelist of Worker env keys that get forwarded to the Container
 * process via `process.env.X`. Keep alphabetically sorted within groups.
 *
 * Why a whitelist? Container envVars must be a finite map of string→string
 * (no dynamic property access at startup time on the CF runtime), and we
 * want to drop undefined values so Dockerfile ENV defaults still work
 * when the secret/var isn't set.
 */
const FORWARDED_ENV_KEYS: readonly (keyof Env)[] = [
    // database
    'OS_DATABASE_URL',
    'OS_DATABASE_AUTH_TOKEN',
    'OS_DATABASE_DRIVER',
    'OS_CONTROL_DATABASE_URL',
    'OS_CONTROL_DATABASE_AUTH_TOKEN',
    'OS_CONTROL_PG_POOL_MIN',
    'OS_CONTROL_PG_POOL_MAX',
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN',
    'TURSO_API_TOKEN',
    'TURSO_ORG_NAME',
    // auth
    'AUTH_SECRET',
    'OS_AUTH_SECRET',
    'AUTH_BASE_URL',
    'OS_BASE_URL',
    'OS_TRUSTED_ORIGINS',
    'OS_COOKIE_DOMAIN',
    'OS_ROOT_DOMAIN',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    // cloud / multi-tenant
    'OS_PROJECT_ID',
    'OS_ORG_ID',
    'OS_CLOUD_URL',
    'OS_CLOUD_API_KEY',
    'OS_MULTI_TENANT',
    // artifact / project
    'OS_PROJECT_ARTIFACT_ROOT',
    'OS_ARTIFACT_PATH',
    'OS_ARTIFACT_CACHE_TTL_MS',
    'OS_ARTIFACT_FETCH_TIMEOUT_MS',
    'OS_DATA_DIR',
    'OS_PROVISION_SYNC',
    'OS_EAGER_SCHEMAS',
    'OS_SKIP_SCHEMA_SYNC',
    // storage
    'OS_STORAGE_ADAPTER',
    'OS_STORAGE_LOCAL_DIR',
    'OS_S3_BUCKET',
    'OS_S3_REGION',
    'OS_S3_ENDPOINT',
    'OS_S3_ACCESS_KEY_ID',
    'OS_S3_SECRET_ACCESS_KEY',
    'OS_S3_FORCE_PATH_STYLE',
    // preview
    'OS_PREVIEW_MODE',
    'OS_PREVIEW_BASE_DOMAINS',
    // performance
    'OS_KERNEL_CACHE_SIZE',
    'OS_KERNEL_TTL_MS',
    'OS_ENV_CACHE_TTL_MS',
    // AI
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'AI_MODEL',
    'AI_GATEWAY_MODEL',
    // MCP
    'MCP_SERVER_ENABLED',
    'MCP_SERVER_NAME',
    'MCP_SERVER_TRANSPORT',
    // misc
    'WEBHOOK_SECRET',
];

/**
 * Durable Object class that owns a single Cloud container instance.
 * The control plane is long-lived and stateful, but all persistent state
 * is offloaded to an external database (Turso / Neon / Postgres) — the
 * container itself is replaceable. We pin to a single Durable Object id
 * so all requests share one process.
 */
export class CloudContainer extends Container<Env> {
    defaultPort = 4000;
    sleepAfter = '30m';
    enableInternet = true;
    requiredPorts = [4000];

    /**
     * Cold start budget for the Node app to bind port 4000.
     *
     * The default in `@cloudflare/containers` is 20s
     * (`TIMEOUT_TO_GET_PORTS_MS`), which is not enough for a fresh
     * boot that has to:
     *   1. Open a Neon Postgres connection (cold start ~1–3s).
     *   2. Run `CREATE TABLE IF NOT EXISTS` for every registered
     *      `sys_*` object — the SQL driver does NOT batch schema sync
     *      yet, so each table costs one network round-trip.
     *   3. Hydrate sys_metadata, then sync any newly hydrated objects
     *      (Phase 3 in `ObjectQLPlugin.start`).
     *   4. Finally start the Hono server which actually opens 4000.
     *
     * Cold first deploy against a fresh Neon DB easily exceeds 20s;
     * 120s gives schema sync room to breathe without wedging warm
     * traffic noticeably (subsequent requests go straight through).
     */
    private readonly PORT_READY_TIMEOUT_MS = 120_000;

    /**
     * Override the auto-start path so the container has the full cold
     * start budget to open port 4000. Without this, `containerFetch`
     * passes only `{ abort: request.signal }` and inherits the 20s
     * default, killing the container mid-schema-sync on first boot.
     *
     * We also explicitly drop the inbound request's abort signal: the
     * Cloudflare Worker request signal fires on subrequest abort
     * (~30–45s), which would cancel the wait even if our timeout is
     * 120s. Detaching the wait from the request lets the container
     * finish booting for the *next* request even if this one's caller
     * already hung up.
     */
    override async startAndWaitForPorts(
        portsOrArgs?: any,
        cancellationOptions?: any,
        startOptions?: any,
    ): Promise<void> {
        // Two call shapes: (ports, cancellationOptions, startOptions)
        // and ({ ports, cancellationOptions, startOptions }). Inject our
        // default timeout and strip the inbound abort signal.
        //
        // Why both `portReadyTimeoutMS` and `instanceGetTimeoutMS`:
        //   - `instanceGetTimeoutMS` (default 8s) bounds the inner
        //     `startContainerIfNotRunning` loop that asks the CF
        //     control plane to provision an instance. On a cold first
        //     deploy that 8s is occasionally too tight.
        //   - `portReadyTimeoutMS` (default 20s) bounds the subsequent
        //     `waitForPort` loop after the instance is up. We need
        //     both because the second budget is computed as
        //     `portReadyTimeout - triesUsed` and any time spent
        //     getting the instance is deducted.
        const TIMEOUT = this.PORT_READY_TIMEOUT_MS;
        if (
            portsOrArgs !== null &&
            typeof portsOrArgs === 'object' &&
            !Array.isArray(portsOrArgs) &&
            ('ports' in portsOrArgs || 'cancellationOptions' in portsOrArgs || 'startOptions' in portsOrArgs)
        ) {
            const inner = { ...(portsOrArgs.cancellationOptions ?? {}) };
            delete inner.abort;
            const merged = {
                ...portsOrArgs,
                cancellationOptions: {
                    portReadyTimeoutMS: TIMEOUT,
                    instanceGetTimeoutMS: TIMEOUT,
                    ...inner,
                },
            };
            return super.startAndWaitForPorts(merged);
        }
        const inner = { ...(cancellationOptions ?? {}) };
        delete inner.abort;
        const merged = {
            portReadyTimeoutMS: TIMEOUT,
            instanceGetTimeoutMS: TIMEOUT,
            ...inner,
        };
        return super.startAndWaitForPorts(portsOrArgs, merged, startOptions);
    }

    // Default envVars baked into every Container. Worker-side secrets/vars
    // forwarded via the constructor below OVERRIDE these (e.g. you can set
    // AUTH_BASE_URL via Dashboard for a custom domain without redeploying).
    envVars: Record<string, string> = {
        NODE_ENV: 'production',
        OS_MODE: 'cloud',
        PORT: '4000',
        HOST: '0.0.0.0',
        // Console IS mounted on the cloud control plane — it provides the
        // Org/Project management UI and claims the root '/' redirect.
        // Studio is disabled (no per-project tenant kernels in this process).
        OS_DISABLE_STUDIO: '1',
        OS_KERNEL_CACHE_SIZE: '50',
        OS_KERNEL_TTL_MS: '1800000',
        OS_ENV_CACHE_TTL_MS: '300000',
        // Cold-start optimization: schema sync (one round-trip per
        // sys_* table on a remote Postgres) routinely runs ~30–60s
        // against a cold Neon DB, which exceeds Cloudflare Workers'
        // inbound-request budget (~30s). The container can never
        // finish booting on a fresh request because the platform
        // tears down the in-flight DO invocation when the inbound
        // request expires. Move DDL out-of-band: run
        // `pnpm --filter @objectstack/cloud migrate` against the
        // production DB before deploying the image, then let the
        // container assume the schema is already there.
        OS_SKIP_SCHEMA_SYNC: '1',
        // Public URL the better-auth instance issues redirects from. MUST
        // match the origin the browser hits, otherwise sign-up / OAuth
        // callbacks fail with "Invalid origin". Override per environment
        // via `wrangler secret put AUTH_BASE_URL` or [vars] in wrangler.toml.
        AUTH_BASE_URL: 'https://cloud.objectos.app',
        // Comma-separated extra origins to add to better-auth's trusted
        // list (custom domains, preview hosts, …). AUTH_BASE_URL is
        // already trusted automatically.
        OS_TRUSTED_ORIGINS: 'https://*.objectstack.workers.dev,https://*.objectos.app',
    };

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        // Forward Worker-level secrets / vars into the Container process.
        // Without this, `wrangler secret put X` only reaches the Worker
        // (V8 isolate), NOT the Node.js container. Empty / non-string
        // values are dropped so Dockerfile ENV defaults still apply when
        // the secret/var isn't configured.
        for (const key of FORWARDED_ENV_KEYS) {
            const value = env[key];
            if (typeof value === 'string' && value.length > 0) {
                this.envVars[key as string] = value;
            }
        }
    }
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const container = getContainer(env.CLOUD, 'singleton');
        // Admin: restart container on demand (used by deploy script to
        // force a fresh image roll-over without waiting for sleepAfter
        // eviction). Requires a shared secret to avoid public abuse.
        const url = new URL(request.url);
        if (url.pathname === '/_admin/restart-container') {
            const provided = request.headers.get('x-admin-secret') ?? '';
            const expected = env.OS_CLOUD_API_KEY ?? '';
            if (!expected || provided !== expected) {
                return new Response('forbidden', { status: 403 });
            }
            try {
                // destroy() = SIGKILL the container; next request cold-starts
                // with whatever image tag is currently bound in wrangler.toml.
                await container.destroy();
                return new Response(JSON.stringify({ ok: true, action: 'destroyed' }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                });
            } catch (err) {
                return new Response(
                    JSON.stringify({ ok: false, error: String((err as Error)?.message ?? err) }),
                    { status: 500, headers: { 'content-type': 'application/json' } },
                );
            }
        }
        return container.fetch(request);
    },
};
