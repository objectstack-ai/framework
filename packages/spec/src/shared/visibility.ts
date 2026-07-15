// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { z } from 'zod';

/**
 * # Conditional-visibility predicate normalization (ADR-0089)
 *
 * One concept — *"show this only when the CEL predicate is TRUE"* — used to be
 * spelled three different ways depending on the layer:
 *
 * | Layer                         | Legacy key   | Canonical    |
 * |:------------------------------|:-------------|:-------------|
 * | Data field / field option     | `visibleWhen`| `visibleWhen`|
 * | View form section / field     | `visibleOn`  | `visibleWhen`|
 * | Page component                | `visibility` | `visibleWhen`|
 *
 * ADR-0089 makes **`visibleWhen`** the single canonical key across all layers
 * (aligning with the `readonlyWhen` / `requiredWhen` family and the resolved
 * `conditionalRequired → requiredWhen` precedent). `visibleOn` and `visibility`
 * stay accepted as `@deprecated` aliases and are folded into `visibleWhen`
 * **once, at the schema boundary** (a zod `.transform()`), so no renderer or
 * validator has to re-implement the fallback.
 *
 * The *binding root* is still determined by the layer — runtime record surfaces
 * bind `record` + `current_user`; metadata-editing forms bind `data` — this
 * unifies the *name*, not the environment.
 */

/** Deprecated alias keys folded into the canonical `visibleWhen`. */
export const VISIBILITY_ALIAS_KEYS = ['visibleOn', 'visibility'] as const;

/** Object carrying the canonical key and/or its deprecated aliases. */
type WithVisibilityAliases = {
  visibleWhen?: unknown;
  visibleOn?: unknown;
  visibility?: unknown;
};

/**
 * Fold the deprecated `visibleOn` / `visibility` aliases into the canonical
 * `visibleWhen` and drop the aliases from the output (ADR-0089 D2). The
 * canonical key wins when present; otherwise the first defined alias is used.
 *
 * Designed to be used as a zod `.transform()` on any object schema that carries
 * a conditional-visibility predicate:
 *
 * ```ts
 * z.object({ ..., visibleWhen: Expr.optional(), visibleOn: Expr.optional() })
 *   .transform(normalizeVisibleWhen)
 * ```
 */
export function normalizeVisibleWhen<T extends WithVisibilityAliases>(
  input: T,
): Omit<T, 'visibleOn' | 'visibility'> {
  const { visibleOn, visibility, ...rest } = input;
  const canonical =
    rest.visibleWhen !== undefined
      ? rest.visibleWhen
      : visibleOn !== undefined
        ? visibleOn
        : visibility;

  if (canonical === undefined) {
    // Nothing to fold — strip the (absent) aliases and return as-is.
    return rest as Omit<T, 'visibleOn' | 'visibility'>;
  }
  return { ...rest, visibleWhen: canonical } as Omit<T, 'visibleOn' | 'visibility'>;
}

/** A key that is (or is a likely mis-spelling of) the visibility predicate. */
function looksLikeVisibilityKey(key: string): boolean {
  return /vis|conceal|hidden|show.?when/i.test(key);
}

/**
 * Custom zod `error` for the `.strict()` view/page schemas (ADR-0089 D3a).
 *
 * With `.strict()`, a key these schemas do not declare — a stale `visibleOn` past
 * removal, a `visibleWhen` typo, or a wrong-layer paste — is now a **loud parse
 * error** instead of a silent strip (ADR-0049 enforce-or-remove, ADR-0078
 * no-silently-inert). This error map turns that rejection into a *fixable* one: it
 * always names the offending key(s), and when a key looks like the
 * conditional-visibility predicate it points the author at the canonical
 * `visibleWhen`. Every other issue code defers to zod's default (`undefined`).
 *
 * Wire it as the object's `error` alongside `.strict()`:
 *
 * ```ts
 * z.object({ ..., visibleWhen: Expr.optional() }, { error: strictVisibilityError })
 *   .strict()
 *   .transform(normalizeVisibleWhen)
 * ```
 */
export const strictVisibilityError: z.core.$ZodErrorMap = (issue) => {
  if (issue.code !== 'unrecognized_keys') return undefined;
  const keys = (issue as { keys?: readonly string[] }).keys ?? [];
  const list = keys.map((k) => `\`${k}\``).join(', ');
  const base =
    `Unrecognized key(s) on this view/page schema: ${list}. ` +
    `Before ADR-0089 D3a these were dropped silently, shipping inert metadata; ` +
    `a mis-layered or stale key is now a loud parse error.`;
  if (keys.some(looksLikeVisibilityKey)) {
    return (
      base +
      ' If this is the conditional-visibility predicate, the canonical key is ' +
      '`visibleWhen` (ADR-0089) — `visibleOn` (view form) and `visibility` (page ' +
      'component) are still accepted as deprecated aliases.'
    );
  }
  return base;
};
