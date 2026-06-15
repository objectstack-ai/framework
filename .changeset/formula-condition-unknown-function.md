---
"@objectstack/formula": patch
---

fix(formula): catch unknown functions in CEL conditions at build (#1877)

`compile()` discarded cel-js's type-check verdict because `check()` returns a `TypeCheckResult` object (`{ valid, error }`), not an array — so the `Array.isArray(checkErrors)` guard never matched. A condition calling an unknown function (`PRIOR(status)`, a typo'd `isBlnk(...)`) type-checks as `found no matching overload`, but that result never surfaced, so `objectstack compile`, `registerFlow`, and the `validate_expression` tool all accepted the predicate, which then silently no-op'd the flow at runtime. Now reads the documented `{ valid, error }` shape, closing the gap for flow conditions, validation rules, and field formulas at once.
