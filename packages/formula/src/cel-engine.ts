/**
 * CEL dialect engine — wraps `@marcbachmann/cel-js` with the ObjectStack
 * stdlib, bounded execution limits, and result coercion.
 *
 * Why a thin wrapper:
 *
 *  - cel-js returns `BigInt` for ints. The kernel and CRM expect plain
 *    numbers, so we coerce at the boundary.
 *  - cel-js parses dotted names as receiver-typed methods; we register
 *    `now()`, `today()`, `daysFromNow()` as bare functions and let `os.*`
 *    refer to context data only (see {@link buildScope}).
 *  - Bounds (`maxAstNodes`, `maxDepth`, …) are enforced spec-wide so
 *    third-party plugins can't ship runaway predicates.
 */

import { Environment } from '@marcbachmann/cel-js';
import type { Expression } from '@objectstack/spec';

import { buildScope, registerStdLib } from './stdlib';
import type { DialectEngine, EvalContext, EvalResult } from './types';

/**
 * Default execution bounds. Picked conservatively — every metadata-authored
 * expression we've seen is well under these. If you hit them, the expression
 * is too complex for ObjectStack and should be moved to a hook (`dialect: js`).
 */
export const DEFAULT_LIMITS = {
  maxAstNodes: 256,
  maxDepth: 32,
  maxListElements: 64,
  maxMapEntries: 64,
  maxCallArguments: 16,
} as const;

function buildEnv(now: () => Date): Environment {
  const env = new Environment({
    unlistedVariablesAreDyn: true,
    enableOptionalTypes: true,
    limits: DEFAULT_LIMITS,
  });
  return registerStdLib(env, now);
}

/** Coerce cel-js's BigInt-flavored return into spec-friendly JS values. */
function coerce(value: unknown): unknown {
  if (typeof value === 'bigint') {
    // BigInt → number when safe, else string to avoid silent truncation.
    if (value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(value);
    }
    return value.toString();
  }
  if (Array.isArray(value)) return value.map(coerce);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = coerce(v);
    return out;
  }
  return value;
}

/**
 * A string that is *entirely* a JS number literal: optional sign, integer
 * and/or fractional part, optional exponent. Deliberately strict — `"5.0"`,
 * `"250000.00"`, `"-3"`, `"1e3"` match; `"5px"`, `"0x10"`, `" "`, `""`,
 * `"1,000"`, `"v2"` do not.
 */
const NUMERIC_STRING_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * cel-js raises `no such overload: dyn <op> int` (and kin) when a comparison
 * or arithmetic operator sees a `string` on one side and a number on the
 * other. ADR-0032 §1c — numeric fields that serialize as strings (`Field.rating`
 * → `"5.0"`, `Field.currency` → `"250000.00"`, `Field.percent`) trip this in
 * flow conditions / formulas (#1530, #1534) even though the schema and the
 * build-time validator treat them as numeric.
 */
function isNumericOverloadError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /no such overload/i.test(message);
}

/**
 * Recursively coerce string values that are *entirely* numeric literals into
 * numbers. Used only on the {@link isNumericOverloadError} retry path, so it
 * can never change a comparison that already evaluated cleanly — it only
 * rescues one that already faulted. Dates and non-numeric strings pass through
 * untouched (a zip like `"02134"` only changes if the surrounding expression
 * already faulted, in which case the original loud error is preserved when the
 * retry still cannot type-check).
 */
function hydrateNumericStrings(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0 && NUMERIC_STRING_RE.test(trimmed)) {
      const n = Number(trimmed);
      if (Number.isFinite(n)) return n;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(hydrateNumericStrings);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = hydrateNumericStrings(v);
    return out;
  }
  return value;
}

function classifyError(err: unknown): EvalResult<never> {
  const message = err instanceof Error ? err.message : String(err);
  let kind: 'parse' | 'type' | 'runtime' | 'bounds' = 'runtime';
  if (/Exceeded max/i.test(message)) kind = 'bounds';
  else if (/parse|unexpected|syntax/i.test(message)) kind = 'parse';
  else if (/type|unknown variable|undeclared/i.test(message)) kind = 'type';
  return { ok: false, error: { kind, message } };
}

export const celEngine: DialectEngine = {
  dialect: 'cel',

  compile(source: string): EvalResult<unknown> {
    try {
      // We use a wall-clock now() here purely for parse-time stdlib
      // type-checking; the function is never actually called.
      const env = buildEnv(() => new Date(0));
      const compiled = env.parse(source);
      // Surface check errors eagerly.
      const checkErrors = compiled.check?.();
      if (checkErrors && Array.isArray(checkErrors) && checkErrors.length > 0) {
        return {
          ok: false,
          error: { kind: 'type', message: checkErrors.join('; ') },
        };
      }
      return { ok: true, value: compiled.ast };
    } catch (err) {
      return classifyError(err);
    }
  },

  evaluate<T = unknown>(expr: Expression, ctx: EvalContext): EvalResult<T> {
    if (expr.dialect !== 'cel') {
      return {
        ok: false,
        error: { kind: 'dialect', message: `celEngine cannot evaluate dialect '${expr.dialect}'` },
      };
    }
    const source = expr.source;
    if (typeof source !== 'string' || source.length === 0) {
      // AST-only inputs: cel-js does not currently expose a public API to
      // re-execute a parsed AST without re-serializing. We persist `source`
      // as the canonical form during M9.1 and revisit AST-only execution in
      // M9.7 when we cut the spec persistence over.
      return {
        ok: false,
        error: { kind: 'parse', message: 'AST-only evaluation not yet supported; persist `source`' },
      };
    }

    const now = () => ctx.now ?? new Date();
    try {
      const env = buildEnv(now);
      const scope = buildScope(ctx);
      try {
        const raw = env.evaluate(source, scope);
        return { ok: true, value: coerce(raw) as T };
      } catch (err) {
        // ADR-0032 §1c — string-serialized numeric fields (`rating` → `"5.0"`,
        // `amount` → `"250000.00"`) make `record.rating >= 4` raise CEL's
        // `no such overload: dyn >= int`. Hydrate purely-numeric strings to
        // numbers and retry ONCE. This only runs after a fault, so a comparison
        // that already evaluated cleanly is never re-interpreted; if the retry
        // still cannot type-check, the original loud error is reported (#1534).
        if (!isNumericOverloadError(err)) throw err;
        const hydrated = hydrateNumericStrings(scope) as Record<string, unknown>;
        try {
          const raw = env.evaluate(source, hydrated);
          return { ok: true, value: coerce(raw) as T };
        } catch {
          // Hydration did not resolve it — surface the original fault, not the
          // retry's, so the message reflects what the author actually wrote.
          throw err;
        }
      }
    } catch (err) {
      return classifyError(err);
    }
  },
};
