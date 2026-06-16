---
---

docs(skill): sync objectstack-formula/automation CEL function tables to the 9.8.0 stdlib

The authoring skills (what the AI reads to know what's callable) under-listed the
stdlib: they showed ~6 functions and capped with "only the stdlib above", omitting
the 14 functions registered in 9.8.0 (`daysBetween`, `abs`, `round`, `min`, `max`,
`upper`, `lower`, `contains`, `startsWith`, `endsWith`, `matches`, `len`, `isEmpty`,
`date`/`datetime`). So AI authors never reached for `daysBetween` (days-remaining)
and kept hand-rolling workarounds.

Rewrites the formula stdlib table (grouped, with the CEL built-ins), fixes the
`daysFromNow`/`daysAgo` note (they keep the wall-clock time, NOT midnight), and
rewrites the automation "time-relative rule" anti-pattern to the precise one-day
**window** pattern (`$gte daysFromNow(N)` / `$lt daysFromNow(N+1)` + `$or`) instead
of the imprecise `BETWEEN TODAY and TODAY+N`. Adds a drift-guard test pinning the
skill ↔ `CEL_STDLIB_FUNCTIONS` so the AI-facing list can't fall behind the runtime
catalog again.
