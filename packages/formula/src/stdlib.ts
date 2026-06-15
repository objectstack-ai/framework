/**
 * ObjectStack standard CEL function library.
 *
 * Registered into the per-evaluation `Environment` by the CEL engine. All
 * functions are pure given a pinned `now` — that determinism is what makes
 * `objectstack build` artifacts byte-stable across runs.
 *
 * Function naming intentionally avoids the `os.` prefix because cel-js binds
 * dotted names to receiver types. Instead, the `os` namespace in CEL holds
 * *data* (`os.user`, `os.org`, `os.env`) supplied by the caller's
 * {@link EvalContext}.
 */

import type { Environment } from '@marcbachmann/cel-js';

import type { EvalContext } from './types';

/** Truncate a Date to start-of-day in UTC. */
function startOfDayUtc(d: Date): Date {
  const out = new Date(d.getTime());
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

/** Add `n` days to a Date in UTC; returns a new Date. */
function addDaysUtc(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/**
 * Register the ObjectStack standard library into a CEL environment.
 *
 * The `now` resolver is closed over so each call uses the pinned
 * `EvalContext.now` (or wall-clock fallback). Implementations are kept tiny
 * and dependency-free — they're the contract surface for AI authors and must
 * stay legible.
 */
export function registerStdLib(
  env: Environment,
  now: () => Date,
): Environment {
  return env
    .registerFunction('now(): google.protobuf.Timestamp', () => now())
    .registerFunction(
      'today(): google.protobuf.Timestamp',
      () => startOfDayUtc(now()),
    )
    .registerFunction(
      'daysFromNow(int): google.protobuf.Timestamp',
      (n: bigint | number) => addDaysUtc(now(), Number(n)),
    )
    .registerFunction(
      'daysAgo(int): google.protobuf.Timestamp',
      (n: bigint | number) => addDaysUtc(now(), -Number(n)),
    )
    // Returns true when `value` is null, undefined, empty string, or empty list.
    // Matches the intent of legacy `ISBLANK()` while staying CEL-idiomatic.
    .registerFunction(
      'isBlank(dyn): bool',
      (value: unknown) => {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.length === 0;
        if (Array.isArray(value)) return value.length === 0;
        return false;
      },
    )
    // Returns `value` when not null/undefined, otherwise the `fallback`.
    // Use this to safely concatenate optional string fields:
    //   coalesce(record.salutation, '') + ' ' + coalesce(record.first_name, '')
    .registerFunction(
      'coalesce(dyn, dyn): dyn',
      (value: unknown, fallback: unknown) =>
        (value === null || value === undefined) ? fallback : value,
    )
    // Trim leading/trailing ASCII whitespace from a string. Returns '' for
    // null/undefined so it composes cleanly with `coalesce`.
    .registerFunction(
      'trim(dyn): string',
      (value: unknown) => {
        if (value === null || value === undefined) return '';
        return String(value).trim();
      },
    )
    // Join a list of values with `sep`, dropping null/undefined/empty entries
    // first. Designed for display-name formulas like:
    //   joinNonEmpty([record.salutation, record.first_name, record.last_name], ' ')
    // which produces 'Alice Martinez' (no leading/trailing/internal extra
    // spaces) when `salutation` is null.
    .registerFunction(
      'joinNonEmpty(list, string): string',
      (list: unknown, sep: unknown) => {
        const arr = Array.isArray(list) ? list : [];
        const separator = typeof sep === 'string' ? sep : ' ';
        const parts: string[] = [];
        for (const item of arr) {
          if (item === null || item === undefined) continue;
          const s = String(item).trim();
          if (s.length > 0) parts.push(s);
        }
        return parts.join(separator);
      },
    );
}

/**
 * Register mixed `double <op> int` / `int <op> double` arithmetic overloads.
 *
 * cel-js types a record field number as `double` and a bare integer literal as
 * `int`, and ships overloads only for matching pairs (`double op double`,
 * `int op int`). So a formula as ordinary as `record.amount / 100` or
 * `record.price * 2` faults at runtime (`no such overload: dyn<double> / int`);
 * the engine catches the fault and the formula silently evaluates to `null`
 * (#1928). Authors then have to know the cel-js quirk and write `/ 100.0`.
 *
 * We close the gap by registering the missing mixed overloads. The result is
 * always computed as a JS `double`, matching CEL's promotion rule for mixed
 * numeric arithmetic. Pure `int op int` is untouched, so integer division
 * (`7 / 2 == 3`) keeps its semantics — these overloads only fire when the two
 * operands are genuinely a `double` and an `int`.
 */
export function registerNumericCoercions(env: Environment): Environment {
  const ops: Record<string, (a: number, b: number) => number> = {
    '+': (a, b) => a + b,
    '-': (a, b) => a - b,
    '*': (a, b) => a * b,
    '/': (a, b) => a / b,
    '%': (a, b) => a % b,
  };
  for (const [op, fn] of Object.entries(ops)) {
    const impl = (a: unknown, b: unknown) => fn(Number(a), Number(b));
    env.registerOperator(`double ${op} int`, impl);
    env.registerOperator(`int ${op} double`, impl);
  }
  return env;
}

/**
 * Build the variable scope for a single evaluation. Absent fields are simply
 * not bound — CEL macros (`has(record.foo)`) handle missing-key safely.
 */
export function buildScope(ctx: EvalContext): Record<string, unknown> {
  const scope: Record<string, unknown> = {};

  if (ctx.record !== undefined) scope.record = ctx.record;
  if (ctx.previous !== undefined) scope.previous = ctx.previous;
  if (ctx.input !== undefined) scope.input = ctx.input;

  // Namespaced data — written as `os.user.id`, `os.env`, etc. in CEL.
  const os: Record<string, unknown> = {};
  if (ctx.user !== undefined) os.user = ctx.user;
  if (ctx.org !== undefined) os.org = ctx.org;
  if (ctx.env !== undefined) os.env = ctx.env;
  if (Object.keys(os).length > 0) scope.os = os;

  if (ctx.extra !== undefined) Object.assign(scope, ctx.extra);

  return scope;
}
