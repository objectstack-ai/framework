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
    // constructor below (undefined values are dropped).
    OS_DATABASE_URL?: string;
    OS_DATABASE_AUTH_TOKEN?: string;
    OS_AUTH_SECRET?: string;
    AUTH_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    OS_S3_BUCKET?: string;
    OS_S3_REGION?: string;
    OS_S3_ENDPOINT?: string;
    OS_S3_ACCESS_KEY_ID?: string;
    OS_S3_SECRET_ACCESS_KEY?: string;
    OS_PREVIEW_BASE_DOMAINS?: string;
}

/**
 * Durable Object class that owns a single Cloud container instance.
 * The control plane is long-lived and stateful, but all persistent state
 * is offloaded to Turso (libSQL) — the container itself is replaceable.
 * We pin to a single Durable Object id so all requests share one process.
 */
export class CloudContainer extends Container<Env> {
    defaultPort = 4000;
    sleepAfter = '30m';
    enableInternet = true;
    requiredPorts = [4000];
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
        // callbacks fail with "Invalid origin". Set on the Container
        // process (NOT [vars] in wrangler.toml) because the Node runtime
        // reads it via process.env at startup.
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
        // (V8 isolate), NOT the Node.js container — keys defined here can
        // be set via Dashboard or `wrangler secret put` and read via
        // `process.env.X` in the container. Undefined values are dropped
        // so we don't override Dockerfile defaults with empty strings.
        const forward: Array<keyof Env> = [
            'OS_DATABASE_URL',
            'OS_DATABASE_AUTH_TOKEN',
            'OS_AUTH_SECRET',
            'AUTH_SECRET',
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET',
            'GITHUB_CLIENT_ID',
            'GITHUB_CLIENT_SECRET',
            'OS_S3_BUCKET',
            'OS_S3_REGION',
            'OS_S3_ENDPOINT',
            'OS_S3_ACCESS_KEY_ID',
            'OS_S3_SECRET_ACCESS_KEY',
            'OS_PREVIEW_BASE_DOMAINS',
        ];
        for (const key of forward) {
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
