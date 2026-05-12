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

    // — Auth (better-auth) —
    AUTH_SECRET?: string;
    OS_AUTH_SECRET?: string;
    AUTH_BASE_URL?: string;
    OS_BASE_URL?: string;
    OS_TRUSTED_ORIGINS?: string;
    OS_COOKIE_DOMAIN?: string;
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
    // auth
    'AUTH_SECRET',
    'OS_AUTH_SECRET',
    'AUTH_BASE_URL',
    'OS_BASE_URL',
    'OS_TRUSTED_ORIGINS',
    'OS_COOKIE_DOMAIN',
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

    // Default envVars baked into every Container. Worker-side secrets/vars
    // forwarded via the constructor below OVERRIDE these (e.g. you can set
    // AUTH_BASE_URL via Dashboard for a custom domain without redeploying).
    envVars: Record<string, string> = {
        NODE_ENV: 'production',
        OS_MODE: 'cloud',
        PORT: '4000',
        HOST: '0.0.0.0',
        OS_DISABLE_CONSOLE: '1',
        OS_KERNEL_CACHE_SIZE: '50',
        OS_KERNEL_TTL_MS: '1800000',
        OS_ENV_CACHE_TTL_MS: '300000',
        // Public URL the better-auth instance issues redirects from. MUST
        // match the origin the browser hits, otherwise sign-up / OAuth
        // callbacks fail with "Invalid origin". Override per environment
        // via `wrangler secret put AUTH_BASE_URL` or [vars] in wrangler.toml.
        AUTH_BASE_URL: 'https://objectstack-cloud.objectstack.workers.dev',
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
        return container.fetch(request);
    },
};
