---
"@objectstack/formula": patch
---

fix(formula): hydrate string-serialized numeric fields in CEL comparisons (#1534)

Numeric fields that serialize as strings — `Field.rating(allowHalf)` → `"5.0"`, `Field.currency(scale)` → `"250000.00"`, `Field.percent` — made comparisons like `record.rating >= 4` fault under strict CEL with `no such overload: dyn >= int`. In flow decision/edge conditions this silently dead-ended the run (no edge matched), and in objectql `applyFormulaPlan` it swallowed to `null`.

The CEL engine now retries an evaluation **once** with purely-numeric strings hydrated to numbers, but only after a `no such overload` fault — so a comparison that already type-checks is never re-interpreted (a zip like `"02134"` stays a string in `record.zip == "02134"`). Because both the automation condition path (`service-automation` `evaluateCondition`) and the objectql formula path route through `ExpressionEngine.evaluate`, both are fixed consistently. A genuinely non-numeric operand (e.g. `record.rating >= 4` where `rating` is `"high"`) still faults loudly rather than being silently rescued.
