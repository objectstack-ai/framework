---
"@objectstack/formula": minor
"@objectstack/objectql": minor
---

feat(formula): timezone-aware `today()` / `daysFromNow()` / `daysAgo()` (ADR-0053 Phase 2)

These are now **calendar-day** functions resolved in a reference timezone, threaded from `ExecutionContext.timezone` (#1978) through `EvalContext.timezone` into the CEL stdlib. Each returns the reference-tz calendar day expressed as a **UTC-midnight `Date`** (ADR-0053 decision D1) — the one representation consistent with how `Field.date` strings hydrate, how the SQL driver normalizes date filters, and how Phase 1 stores dates. So `record.close_date == daysFromNow(30)` now matches in-memory too, not just at the storage boundary. The timezone calculation uses `Intl.DateTimeFormat` (DST-safe; no hand-rolled offset math).

**⚠️ Behavior change:** `daysFromNow(n)` / `daysAgo(n)` previously kept the wall-clock time of `now` (e.g. `daysFromNow(30)` at `10:00Z` → `…T10:00:00Z`). They now drop the time and return the calendar day at **midnight** (`…T00:00:00Z`) — the ADR-0053 "defect #3" fix. `today()` is unchanged at UTC (it already truncated to start-of-day). For a genuine sub-day offset use the documented escape hatch `now() + duration("Nh")`.

With no reference timezone configured the zone resolves to `UTC`, so `today()` is byte-for-byte unchanged; only the `daysFromNow`/`daysAgo` midnight-truncation differs from before. `objectql` threads `execCtx.timezone` into read-time formula evaluation (`applyFormulaPlan`) and default-value expressions (`applyFieldDefaults`).

Part of #1980. (Consuming a non-UTC reference timezone end-to-end also needs the `localization` settings manifest noted in #1978.)
