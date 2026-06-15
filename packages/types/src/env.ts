// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Environment-variable helpers shared across `@objectstack/*` packages.
 *
 * The framework standardises on `OS_*` prefixed env vars (see AGENTS.md
 * "Environment Variables" section). Some historical names predate this
 * convention — `AUTH_SECRET`, `ROOT_DOMAIN`, `OBJECTSTACK_*`, …
 *
 * To migrate without breaking user `.env` files mid-release, call
 * {@link readEnvWithDeprecation} at every legacy read site:
 *
 *   const v = readEnvWithDeprecation('OS_AUTH_SECRET', 'AUTH_SECRET');
 *
 * If only the legacy name is set, the value is still returned but a
 * one-shot `console.warn` fires (per-process per-variable) telling
 * operators to rename it.
 */

const _warnedKeys = new Set<string>();

/**
 * Read an env var, preferring the canonical `OS_*` name and falling
 * back to one or more legacy aliases.
 *
 * When only a legacy alias is set, emits a one-shot deprecation warning.
 * The warning is process-wide deduplicated: identical (preferred, legacy)
 * pairs will only warn once even if read from multiple call sites.
 *
 * Legacy aliases are checked in order; the first one with a defined
 * value wins (and triggers the warning for that specific alias).
 *
 * Safe to call from environments where `process` is unavailable (returns
 * `undefined`); the warning is suppressed when running outside Node-like
 * runtimes that lack `console.warn`.
 *
 * @param preferred  Canonical OS_*-prefixed env var name.
 * @param legacy     Older name (or array of older names) to fall back on.
 * @param options    Optional behaviour flags. Set `silent: true` for aliases
 *                   that remain accepted conventions rather than true legacy
 *                   names — e.g. `PORT`, which PaaS platforms (Render, Railway,
 *                   Heroku, Fly, …) inject automatically. Warning on those
 *                   would nag operators about env they never set.
 * @returns The resolved value, or `undefined` if neither is set.
 */
export function readEnvWithDeprecation(
  preferred: string,
  legacy: string | readonly string[],
  options?: { silent?: boolean },
): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  if (!env) return undefined;

  const preferredValue = env[preferred];
  if (preferredValue !== undefined) return preferredValue;

  const legacyList = typeof legacy === 'string' ? [legacy] : legacy;
  for (const legacyName of legacyList) {
    const legacyValue = env[legacyName];
    if (legacyValue !== undefined) {
      const dedupeKey = `${preferred}|${legacyName}`;
      if (!options?.silent && !_warnedKeys.has(dedupeKey)) {
        _warnedKeys.add(dedupeKey);
        const consoleRef = (globalThis as { console?: { warn?: (msg: string) => void } }).console;
        try {
          consoleRef?.warn?.(
            `[ObjectStack] Env var \`${legacyName}\` is deprecated; rename it to \`${preferred}\`. ` +
            `The legacy name still works for now but will be removed in a future major release.`,
          );
        } catch {
          /* `console.warn` unavailable (exotic runtime) — ignore */
        }
      }
      return legacyValue;
    }
  }

  return undefined;
}

/**
 * Internal: clear the dedupe set. Test-only; exposed so suite-wide
 * deprecation warnings don't bleed between tests.
 *
 * @internal
 */
export function _resetEnvDeprecationWarnings(): void {
  _warnedKeys.clear();
}
