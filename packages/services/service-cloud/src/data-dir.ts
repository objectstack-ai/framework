// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Default data-directory + serverless-platform detection.
 *
 * Single source of truth for the on-disk location of the control-plane
 * SQLite file (`control.db`), per-project SQLite files, and InMemoryDriver
 * persistence JSON files in **non-serverless** deployments.
 *
 * On serverless platforms with a read-only application bundle (Vercel,
 * AWS Lambda, Netlify Functions, Cloudflare Workers Node compat) the
 * file-backed default is unsupported — `/var/task` is read-only and
 * `/tmp` is per-instance, ephemeral, and not shared between concurrent
 * cold starts. Persisting business data there silently corrupts
 * deployments. The recommended (and only sensible) default for these
 * platforms is **Turso / libSQL** — set `TURSO_DATABASE_URL` (or
 * `OS_CONTROL_DATABASE_URL=libsql://…`) and the cloud-stack driver
 * factory will pick it up automatically.
 *
 * Resolution order for {@link resolveDefaultDataDir}:
 *
 *   1. `OS_DATA_DIR` environment variable (explicit override — wins
 *      always, even on serverless; intended for self-managed mounts
 *      such as a network volume or EFS share).
 *   2. `<cwd>/.objectstack/data` on a writable filesystem (the default
 *      for `objectstack dev`, `objectstack serve`, Docker, bare metal, …).
 *   3. **THROWS** on a detected serverless read-only filesystem. The
 *      error message tells the user exactly which env var to set.
 *
 * Centralising this logic prevents both
 * (a) the "ENOENT: mkdir '/var/task/.objectstack'" cold-start crash, and
 * (b) the worse failure mode where an ephemeral `/tmp` SQLite "works"
 *     for a single cold start and silently loses data on the next one.
 */

import { resolve as resolvePath } from 'node:path';

/**
 * Returns `true` when the current process is running on a serverless
 * platform whose application bundle is a read-only filesystem and whose
 * `/tmp` is per-instance / ephemeral. The set of detected platforms
 * intentionally matches the ones where ObjectStack is regularly deployed
 * today; new platforms can be added via the `OS_READONLY_FS=1` escape
 * hatch.
 */
export function isServerlessReadOnlyFs(env: NodeJS.ProcessEnv = process.env): boolean {
    if (env.OS_READONLY_FS && ['1', 'true', 'yes', 'on'].includes(env.OS_READONLY_FS.trim().toLowerCase())) {
        return true;
    }
    // Vercel sets VERCEL=1 in all build & runtime environments.
    if (env.VERCEL === '1') return true;
    // AWS Lambda & Lambda@Edge.
    if (env.AWS_LAMBDA_FUNCTION_NAME) return true;
    // Netlify Functions.
    if (env.NETLIFY === 'true' || env.NETLIFY_DEV) return true;
    return false;
}

/**
 * Build the standard "configure a persistent database" error message
 * shown when a file-backed default is requested on serverless.
 * @internal
 */
export function buildServerlessPersistenceError(role: 'control' | 'project' = 'control'): Error {
    const urlVar = role === 'control' ? 'TURSO_DATABASE_URL (or OS_CONTROL_DATABASE_URL)' : 'OS_DATABASE_URL';
    const tokenVar = role === 'control' ? 'TURSO_AUTH_TOKEN (or OS_CONTROL_DATABASE_AUTH_TOKEN)' : 'OS_DATABASE_AUTH_TOKEN';
    return new Error(
        `[objectstack/service-cloud] Detected a serverless read-only filesystem ` +
        `(Vercel / AWS Lambda / Netlify) but no persistent database is configured ` +
        `for the ${role === 'control' ? 'control plane' : 'project data plane'}. ` +
        `Set ${urlVar} to a libsql:// URL (recommended on Vercel — Turso is the ` +
        `default ObjectStack pairing for serverless) and ${tokenVar} to the ` +
        `matching auth token. ` +
        `For self-hosted Postgres / MySQL, set the same variable to a ` +
        `postgres:// or mysql:// URL instead. ` +
        `If you have a writable persistent mount (EFS, network volume, …), ` +
        `set OS_DATA_DIR to its path to opt out of this check. ` +
        `File-backed SQLite is rejected on these platforms because /tmp is ` +
        `per-instance and ephemeral, which silently corrupts data across ` +
        `concurrent invocations.`,
    );
}

/**
 * Resolve the canonical default data directory for SQLite / file-backed
 * driver persistence. See module docstring for precedence rules.
 *
 * Throws on serverless platforms unless `OS_DATA_DIR` is set — see
 * {@link buildServerlessPersistenceError} for the rationale.
 *
 * @param env - Optional process-env override, primarily for tests.
 * @returns Absolute filesystem path. Never returns a trailing slash.
 */
export function resolveDefaultDataDir(env: NodeJS.ProcessEnv = process.env): string {
    const explicit = env.OS_DATA_DIR?.trim();
    if (explicit) return resolvePath(explicit);

    if (isServerlessReadOnlyFs(env)) {
        throw buildServerlessPersistenceError('control');
    }

    return resolvePath(process.cwd(), '.objectstack/data');
}
