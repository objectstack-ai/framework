---
'@objectstack/spec': minor
---

feat(spec): `inlineEdit` on relationship fields for declarative master-detail

A `master_detail`/`lookup` field can now declare `inlineEdit: true` (plus
optional `inlineTitle` / `inlineColumns` / `inlineAmountField`) to mean "these
child records are entered/edited inline within the parent's form". The intent
lives in the data model: the parent's standard create/edit form then renders an
atomic master-detail form (object fields + an editable child grid) with no form
view config and no bespoke page. Use for line-item/composition children; leave
off for associations (comments, attachments). Renderer support is in objectui.
