// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { readEnvWithDeprecation } from '@objectstack/types';

// ---------------------------------------------------------------------------
// Kernel logger level resolution (shared by `serve`, and forwarded by
// `start` / `dev`).
//
// `serve` used to hard-pin the kernel logger to `silent` so the CLI could own
// a clean startup banner. That silenced every runtime fault plugins surface
// through `logger.warn` / `logger.error` — most importantly the record-change
// trigger's flow-execution-failure warnings and the automation engine's
// internal errors — making a faulting flow fail completely silently and
// defeating ADR-0032's "fail loudly" promise (see #1533).
//
// The level is resolved from (in precedence order):
//   1. `--verbose`            → `debug`
//   2. `--log-level <level>`  → explicit level
//   3. `$OS_LOG_LEVEL` / `$LOG_LEVEL`
//   4. default                → `warn`
//
// The default is `warn` rather than `silent`: warnings + errors reach the
// operator out of the box while the boot-quiet window in `serve` still
// suppresses the noisier info-level startup chatter. Pass `--log-level silent`
// (or `OS_LOG_LEVEL=silent`) to restore the fully-quiet behavior.
// ---------------------------------------------------------------------------
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const;
export type CliLogLevel = (typeof LOG_LEVELS)[number];

/** Default kernel logger level when nothing is configured. */
export const DEFAULT_LOG_LEVEL: CliLogLevel = 'warn';

/**
 * Resolve the kernel logger level from CLI flags and an explicit env value.
 * Unknown / malformed levels fall back to {@link DEFAULT_LOG_LEVEL} rather
 * than throwing, so a typo never crashes the server boot.
 */
export function resolveLogLevel(opts: {
  verbose?: boolean;
  flag?: string;
  envLevel?: string;
}): CliLogLevel {
  if (opts.verbose) return 'debug';
  const raw = (opts.flag ?? opts.envLevel ?? DEFAULT_LOG_LEVEL).toLowerCase().trim();
  return (LOG_LEVELS as readonly string[]).includes(raw) ? (raw as CliLogLevel) : DEFAULT_LOG_LEVEL;
}

/**
 * Read `$OS_LOG_LEVEL` (preferred) / `$LOG_LEVEL` (legacy) from the
 * environment, emitting the standard deprecation warning for the legacy name.
 */
export function readLogLevelEnv(): string | undefined {
  return readEnvWithDeprecation('OS_LOG_LEVEL', 'LOG_LEVEL');
}
