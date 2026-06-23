---
"@objectstack/spec": minor
---

feat(spec): dataset authoring form + derived measures without a dummy aggregate

`dataset` was the only UI-authorable metadata type without a `defineForm`
layout, so Studio's create surface fell back to the auto-generated flat layout
(free-text `object`, no grouping). Adds `dataset.form.ts` (registered in
`METADATA_FORM_REGISTRY`): sectioned Basics / Source / Dimensions / Measures
with an `object` picker (`ref:object`) and guidance — matching the sibling
`report` editor.

Also makes `DatasetMeasureSchema.aggregate` optional. A derived measure
(`derived: { op, of }`) combines other measures by name and `aggregate` is
ignored for it at compile time, but the schema still required it — so a derived
measure failed validation unless you added a meaningless aggregate. `aggregate`
is now required only for non-derived measures (enforced in the existing
`superRefine`). Backward compatible: existing measures that carry an aggregate
stay valid.
