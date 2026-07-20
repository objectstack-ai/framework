---
"@objectstack/formula": minor
---

**Stored `Field.formula` fields that compute dates/durations no longer silently evaluate to `null` (#3306).** Three independent CEL gaps made shipped template formulas (e.g. `hr_employee.tenure_years`, `hr_time_off_request.days`) return `null` with no parse/build/runtime error:

1. **The null-guard idiom `cond ? <value> : null` now compiles and evaluates.** cel-js's ternary type-unifier rejects a concrete `int`/`double`/`string` branch against `null` — so even `true ? 5 : null` faulted *"Ternary branches must have the same type"* and the whole formula nulled. A `Field.formula` is inherently nullable and the catalog blesses both ternary and `== null`, so this is the canonical "compute value, else blank" shape. An AST pre-pass (mirroring the #3183 temporal-equality rewrite) wraps the non-null branch in `dyn(...)` — value-preserving, null-branch-only, idempotent — so it type-checks and runs. Applied in `compile()`, `evaluate()`, and the build soundness check alike.

2. **`floor(x)` / `ceil(x)` are now registered** (parallel to `round`/`abs`) and advertised in the catalog. They round toward −∞ / +∞, so `floor(-1.2) == -2` — NOT interchangeable with integer division's round-toward-zero. Previously `floor(...)` faulted `found no matching overload` and the formula nulled.

3. **Date arithmetic is now a build-time ERROR instead of a silent runtime `null`.** `record.end_date - record.start_date + 1`, `today() + 30`, `record.date + n` type-check clean (operands are `dyn`) but always fault at runtime and never recover (a date string is not numeric, so hydration can't rescue it). The build soundness check now types `date`/`datetime` fields as `google.protobuf.Timestamp` and flags date/duration **arithmetic against a number** with a corrective message pointing at `daysBetween(a, b)` / `daysFromNow(n)` / `addDays(d, n)` / `addMonths(d, n)`. Sound by construction — ordering (`date < today()`, `date < "2026-01-01"` string-lex), equality (#3183), and string concatenation (`"Due: " + date`) are all runtime-tolerated and never flagged; only arithmetic against a number is. A `!= null` guard on a date field no longer masks the inner fault (`== null` no-op overloads registered in the check-only env).

> **Heads-up for downstream:** (3) adds a NEW build-time error. A stored formula or predicate doing arithmetic on a `date`/`datetime` field (`end - start + 1`, `today() + 30`) that previously built (and nulled at runtime) will now fail `objectstack build` / `validateStackExpressions` with a message telling you to use `daysBetween` / `daysFromNow` / `addDays`. This only fires for genuinely-broken expressions that already returned `null`.

Fixes #3306.
