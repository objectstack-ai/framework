---
"@objectstack/driver-sql": patch
---

fix(driver-sql): `Field.date` is now stored and returned as a tz-naive `YYYY-MM-DD` calendar day (ADR-0053 Phase 1)

A `Field.date` ("close date", "due date", "birthday") is semantically a **timezone-naive calendar day**, but the SQL driver was treating it as an *instant*: `formatInput` wrote the value verbatim (keeping any time component, so `dev.db` held `close_date = "2026-07-15T17:24:56.533Z"`), while the filter layer (`coerceFilterValue`) already normalized the comparand to date-only `YYYY-MM-DD`. That write/filter asymmetry meant a date-equality filter — `close_date == '2026-07-15'`, `expires_on: { $in: [...] }`, or a `daysFromNow(n)`-style comparand — compared `"2026-07-15T17:24Z"` against `"2026-07-15"` and **silently matched nothing**.

This patch aligns the write/read boundary with the date-only contract the filter already enforced:

- **Write** (`formatInput`): every `Field.date` value (a JS `Date`, a full-ISO string, or an already date-only string) collapses to `YYYY-MM-DD` before insert/update. A `Date` collapses to its UTC calendar day, matching `coerceFilterValue`.
- **Read** (`formatOutput`): `Field.date` values are returned as `YYYY-MM-DD`, slicing any stored time component. This transparently repairs legacy rows that were written as a full timestamp, so date-equality works **without a data migration**. Read normalization now runs on the `find` path for every dialect (previously only `findOne`), matching the new behaviour.
- The truncation logic is shared by the filter, write and read paths via a single `toDateOnly` helper, so all three agree on what a date *is*.

`Field.datetime` is **unchanged** — it keeps full-instant (UTC millisecond) semantics.

Out of scope (ADR-0053 Phase 2): timezone-aware `today()`/`daysFromNow()`/`daysAgo()`, an org/user reference timezone, and `datetime` render-time TZ. See ADR-0053 and issue #1928.
