// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Cloudflare Containers entrypoint for ObjectOS.
 *
 * The Worker fronts a Container-class Durable Object that runs the
 * Node.js image built from `apps/objectos/Dockerfile`. All HTTP traffic
 * is forwarded 1:1 to the container on port 3000.
 *
 * Deploy with:
 *   wrangler deploy --config apps/objectos/wrangler.toml
 *
 * See `apps/objectos/wrangler.toml` for the full deployment workflow
 * (build + push image, then deploy Worker).
 */

import { Container, getContainer } from '@cloudflare/containers';

export interface Env {
    OBJECTOS: DurableObjectNamespace<ObjectOSContainer>;
    // ── Secrets / vars forwarded to the Container process ────────────────
    // Set via `wrangler secret put X` or `[vars]` in wrangler.toml.
    // Keep in sync with FORWARDED_ENV_KEYS below.

    // — Database (tenant) —
    OS_DATABASE_URL?: string;
    OS_DATABASE_AUTH_TOKEN?: string;
    OS_DATABASE_DRIVER?: string;
    TURSO_DATABASE_URL?: string;
    TURSO_AUTH_TOKEN?: string;

    // — Auth —
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

    // — Cloud client (point this objectos at a control plane) —
    OS_CLOUD_URL?: string;
    OS_CLOUD_API_KEY?: string;
    OS_PROJECT_ID?: string;
    OS_ORG_ID?: string;

    // — Artifact / project —
    OS_PROJECT_ARTIFACT_ROOT?: string;
    OS_ARTIFACT_PATH?: string;
    OS_ARTIFACT_CACHE_TTL_MS?: string;
    OS_ARTIFACT_FETCH_TIMEOUT_MS?: string;
    OS_DATA_DIR?: string;
    OS_PROVISION_SYNC?: string;
    OS_EAGER_SCHEMAS?: string;

    // — Storage —
    OS_STORAGE_ADAPTER?: string;
    OS_STORAGE_LOCAL_DIR?: string;
    OS_S3_BUCKET?: string;
    OS_S3_REGION?: string;
    OS_S3_ENDPOINT?: string;
    OS_S3_ACCESS_KEY_ID?: string;
    OS_S3_SECRET_ACCESS_KEY?: string;
    OS_S3_FORCE_PATH_STYLE?: string;

    // — Performance —
    OS_KERNEL_CACHE_SIZE?: string;
    OS_KERNEL_TTL_MS?: string;
    OS_ENV_CACHE_TTL_MS?: string;

    // — AI —
    OPENAI_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    GOOGLE_GENERATIVE_AI_API_KEY?: string;
    AI_MODEL?: string;
    AI_GATEWAY_MODEL?: string;

    // — MCP —
    MCP_SERVER_ENABLED?: string;
    MCP_SERVER_NAME?: string;
    MCP_SERVER_TRANSPORT?: string;

    // — Misc —
    WEBHOOK_SECRET?: string;
}

const FORWARDED_ENV_KEYS: readonly (keyof Env)[] = [
    // database
    'OS_DATABASE_URL', 'OS_DATABASE_AUTH_TOKEN', 'OS_DATABASE_DRIVER',
    'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN',
    // auth
    'AUTH_SECRET', 'OS_AUTH_SECRET',
    'AUTH_BASE_URL', 'OS_BASE_URL',
    'OS_TRUSTED_ORIGINS', 'OS_COOKIE_DOMAIN',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
    'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET',
    // cloud client
    'OS_CLOUD_URL', 'OS_CLOUD_API_KEY',
    'OS_PROJECT_ID', 'OS_ORG_ID',
    // artifact
    'OS_PROJECT_ARTIFACT_ROOT', 'OS_ARTIFACT_PATH',
    'OS_ARTIFACT_CACHE_TTL_MS', 'OS_ARTIFACT_FETCH_TIMEOUT_MS',
    'OS_DATA_DIR', 'OS_PROVISION_SYNC', 'OS_EAGER_SCHEMAS',
    // storage
    'OS_STORAGE_ADAPTER', 'OS_STORAGE_LOCAL_DIR',
    'OS_S3_BUCKET', 'OS_S3_REGION', 'OS_S3_ENDPOINT',
    'OS_S3_ACCESS_KEY_ID', 'OS_S3_SECRET_ACCESS_KEY', 'OS_S3_FORCE_PATH_STYLE',
    // performance
    'OS_KERNEL_CACHE_SIZE', 'OS_KERNEL_TTL_MS', 'OS_ENV_CACHE_TTL_MS',
    // AI
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY',
    'AI_MODEL', 'AI_GATEWAY_MODEL',
    // MCP
    'MCP_SERVER_ENABLED', 'MCP_SERVER_NAME', 'MCP_SERVER_TRANSPORT',
    // misc
    'WEBHOOK_SECRET',
];

/**
 * Durable Object class that owns a single ObjectOS container instance.
 * Cloudflare routes traffic to a specific instance by Durable Object id;
 * we use a single shared id so all requests hit the same long-lived
 * Node.js process (control-plane state lives in Turso, not the
 * container's filesystem, so this is safe and cheap).
 */
export class ObjectOSContainer extends Container<Env> {
    defaultPort = 3000;
    sleepAfter = '15m';
    enableInternet = true;
    requiredPorts = [3000];

    envVars: Record<string, string> = {
        NODE_ENV: 'production',
        PORT: '3000',
        HOST: '0.0.0.0',
        OS_KERNEL_CACHE_SIZE: '50',
        OS_KERNEL_TTL_MS: '1800000',
        OS_ENV_CACHE_TTL_MS: '300000',
    };

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        // Forward Worker-level secrets / vars into the Container process.
        // Without this, `wrangler secret put X` only reaches the Worker
        // (V8 isolate), NOT the Node.js container.
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
        const container = getContainer(env.OBJECTOS, 'singleton');
        return container.fetch(request);
    },
};
