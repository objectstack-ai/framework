---
"@objectstack/objectql": patch
---

**Enforce per-option `visibleWhen` on `checkboxes` fields, and match option values by string form (objectui#2729).** Server-side per-option gating already covered `select` / `multiselect` / `radio`, but two holes let gated values through on write:

- **`checkboxes` was not enforced.** `CHOICE_FIELD_TYPES` omitted `checkboxes`, so a gated `checkboxes` option (whose client widget cascades identically to `multiselect` since objectui#2715) was hidden in the UI but accepted from a crafted write. Added `checkboxes` to the enforced set — its picked values are now re-evaluated against each option's `visibleWhen` (record + `current_user`) on insert/update/bulk-update, element-wise, like `multiselect`.
- **Numeric option values could slip the gate.** Option matching used strict `===`, but the enum-membership validator compares by `String(...)`. A numeric option value submitted as a string (a normal REST/JSON round-trip) passed the enum check yet missed its `visibleWhen` gate (fail-open). Matching now coerces both sides with `String(...)`, so the two validators agree on which option a written value denotes.

Behavior for `select` / `multiselect` / `radio` is unchanged. Fail-open on unbound `current_user` / unevaluable predicates is preserved.
