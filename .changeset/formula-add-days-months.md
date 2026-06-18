---
"@objectstack/formula": minor
---

Add `addDays(date, n)` and `addMonths(date, n)` to the CEL standard library — shift an arbitrary date by a (possibly negative) number of days or months. Unlike `daysFromNow`, these operate on a *given* date (the "next service date = last service + cycle" shape). `addMonths` clamps to the target month's last day (`addMonths(date('2026-01-31'), 1)` → Feb 28, never overflowing into March). Both coerce their inputs (Date | ISO string | epoch) and type `n` as `dyn` so a record number field arriving as a `double` doesn't fault `no such overload` (#1928).
