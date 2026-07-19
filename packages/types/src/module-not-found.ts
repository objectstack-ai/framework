// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * True when a dynamic `import()` / `require.resolve()` failed because the
 * module is simply NOT INSTALLED — as opposed to the module being present but
 * throwing while it loads (a real crash). Checking `err.code` FIRST matters:
 * ESM reports a missing package as `err.code === 'ERR_MODULE_NOT_FOUND'` with
 * the human message `Cannot find package '...'`; matching only the older
 * `Cannot find module` string mis-classifies that as a crash (framework#1595).
 *
 * Single shared owner for this classification (framework#3265): the CLI's
 * optional-plugin guards and `requires` capability resolver delegate here, and
 * cloud's `objectos-runtime` capability loader is expected to adopt it at its
 * next framework pin bump — so the parallel loaders cannot drift apart and
 * re-introduce the #1595 false-alarm class.
 */
export function isModuleNotFoundError(err: unknown): boolean {
  const code = (err as { code?: string } | null | undefined)?.code;
  if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('Cannot find module') || msg.includes('Cannot find package');
}
