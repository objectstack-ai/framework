---
"@objectstack/formula": patch
---

fix(formula): hydrate ISO date/datetime strings on CEL `no such overload` fault (#1530)

Date-typed formula fields and date predicates always evaluated to `null`:
`Field.date`/`Field.datetime` serialize to ISO strings, and cel-js compared the
raw string against the `google.protobuf.Timestamp` from `today()`/`now()`/
`daysFromNow()`, raising `no such overload` (swallowed to null). The existing
numeric-string fault-retry (#1534) is now extended to also coerce strict ISO-8601
date/date-time strings to `Date` before retrying once, fixing every caller
(formula fields, flow conditions, validation/workflow predicates). Hydration runs
only after a fault, so clean expressions are never re-interpreted and genuine
non-temporal strings still fault loudly.
