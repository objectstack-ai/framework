// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Duration literal parsing for ADR-0057 lifecycle policies.
 *
 * The spec (`LifecycleSchema`, `@objectstack/spec`) validates the literal
 * shape (`/^\d+(h|d|w|y)$/`); this is the single runtime consumer that turns
 * it into milliseconds. Calendar-exact arithmetic is deliberately avoided:
 * retention windows are coarse operational bounds, so `y` is 365 days.
 */
const UNIT_MS: Record<string, number> = {
  h: 3_600_000,
  d: 86_400_000,
  w: 7 * 86_400_000,
  y: 365 * 86_400_000,
};

export const LIFECYCLE_DURATION_REGEX = /^(\d+)(h|d|w|y)$/;

/**
 * Parse a lifecycle duration literal (`'6h'`, `'14d'`, `'12w'`, `'7y'`) to
 * milliseconds. Throws on malformed input — declarations reach the runtime
 * already validated by the spec, so a parse failure here is a programming
 * error, not user input.
 */
export function parseLifecycleDuration(literal: string): number {
  const m = LIFECYCLE_DURATION_REGEX.exec(literal);
  if (!m) {
    throw new Error(
      `[lifecycle] invalid duration literal '${literal}' — expected <n><unit> with unit h|d|w|y (e.g. '14d')`,
    );
  }
  return Number(m[1]) * UNIT_MS[m[2]];
}
