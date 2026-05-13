// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Boot environment resolution.
 *
 * Single source of truth for reading `process.env` related to deployment
 * mode selection. All other modules in this package consume the resolved
 * values via the helpers exported here — no other module reads
 * `process.env` directly.
 *
 * Each helper accepts an optional `env` override so callers (and tests)
 * can pass an explicit environment without mutating the process.
 */

import { z } from 'zod';

export const BootEnvSchema = z.object({
    OS_MODE: z.string().optional(),
    OS_MULTI_PROJECT: z.string().optional(),
    AUTH_SECRET: z.string().optional(),
    AUTH_BASE_URL: z.string().optional(),
    OS_BASE_URL: z.string().optional(),
    NEXT_PUBLIC_BASE_URL: z.string().optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
    VERCEL_URL: z.string().optional(),
    PORT: z.coerce.number().optional(),
    OS_PROJECT_ID: z.string().optional(),
    OS_ARTIFACT_PATH: z.string().optional(),
    OS_DATABASE_URL: z.string().optional(),
    OS_DATABASE_AUTH_TOKEN: z.string().optional(),
    OS_DATABASE_DRIVER: z.string().optional(),
    TURSO_DATABASE_URL: z.string().optional(),
    TURSO_AUTH_TOKEN: z.string().optional(),
});

export type BootEnv = z.infer<typeof BootEnvSchema>;
export type BootMode = 'runtime' | 'cloud' | 'standalone';

const DEV_AUTH_SECRET_FALLBACK =
    'dev-secret-please-change-in-production-min-32-chars';

function envFlag(value: string | undefined): boolean {
    return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function pickEnv(env?: Record<string, string | undefined>): Record<string, string | undefined> {
    return env ?? (process.env as Record<string, string | undefined>);
}

/**
 * Resolve the deployment mode from environment.
 *
 * Recognised values:
 *   - `standalone`                                            → `'standalone'` (default)
 *   - `runtime`, `project`, `local`, `single-project`         → `'runtime'`
 *   - `cloud`, `multi-project`                                → `'cloud'`
 *
 * Falls back to `'standalone'` when unset; logs a warning and falls back
 * to `'standalone'` when the value is unrecognised. The legacy
 * `OS_MULTI_PROJECT=true` flag is still honoured (with a
 * deprecation warning) when `OS_MODE` is unset.
 *
 * The `project` value continues to be accepted as a deprecated alias for
 * `runtime` — that mode was renamed in the v4.x series to better reflect
 * its role (a runtime node connected to ObjectStack Cloud) and to leave
 * "project" available as a domain term.
 */
export function resolveMode(env?: Record<string, string | undefined>): BootMode {
    const e = pickEnv(env);
    const raw = e.OS_MODE?.trim().toLowerCase();
    if (raw === 'cloud' || raw === 'multi-project') return 'cloud';
    if (raw === 'standalone') return 'standalone';
    if (raw === 'runtime') return 'runtime';
    if (raw === 'project' || raw === 'local' || raw === 'single-project') {
        // eslint-disable-next-line no-console
        console.warn(
            `[objectstack] OS_MODE=${raw} is a deprecated alias for "runtime"; please update your config.`,
        );
        return 'runtime';
    }
    if (raw && raw.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(`[objectstack] Unknown OS_MODE=${raw}; falling back to "standalone".`);
    }
    if (envFlag(e.OS_MULTI_PROJECT)) {
        // eslint-disable-next-line no-console
        console.warn(
            '[objectstack] OS_MULTI_PROJECT is deprecated. Use `OS_MODE=cloud` instead.',
        );
        return 'cloud';
    }
    return 'standalone';
}

/**
 * Auth secret used by `plugin-auth` (better-auth). Returns the dev
 * fallback when unset — explicit warning is the caller's responsibility.
 */
export function resolveAuthSecret(env?: Record<string, string | undefined>): string {
    const e = pickEnv(env);
    return e.AUTH_SECRET ?? DEV_AUTH_SECRET_FALLBACK;
}

/**
 * Public origin used by better-auth callbacks.
 *
 * Resolution order (highest priority first):
 *   1. `AUTH_BASE_URL` — explicit, framework-wide (matches what
 *      better-auth itself reads via `BETTER_AUTH_URL`).
 *   2. `OS_BASE_URL`   — ObjectStack-specific alias.
 *   3. `NEXT_PUBLIC_BASE_URL` — Next.js apps that publish their public URL.
 *   4. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel stable prod URL.
 *   5. `VERCEL_URL` — Vercel per-deploy URL.
 *   6. `http://localhost:<PORT|3000>` — last-resort dev fallback.
 *
 * The CLI's `serve` command builds its trustedOrigins allow-list from
 * the same env vars (see packages/cli/src/commands/serve.ts) — keep
 * the precedence here in sync.
 */
export function resolveBaseUrl(env?: Record<string, string | undefined>): string {
    const e = pickEnv(env);
    return (
        e.AUTH_BASE_URL
        ?? e.OS_BASE_URL
        ?? e.NEXT_PUBLIC_BASE_URL
        ?? (e.VERCEL_PROJECT_PRODUCTION_URL ? `https://${e.VERCEL_PROJECT_PRODUCTION_URL}` : undefined)
        ?? (e.VERCEL_URL ? `https://${e.VERCEL_URL}` : undefined)
        ?? `http://localhost:${e.PORT ?? 3000}`
    );
}
