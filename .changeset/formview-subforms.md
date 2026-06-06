---
'@objectstack/spec': minor
---

feat(spec): `FormViewSchema.subforms` for config-driven master-detail

A form view can now declare inline child collections via `subforms`, so the
standard create/edit form for an object can render as a master-detail form
(object fields on top, an editable child grid below, persisted atomically)
without a bespoke page. Each entry needs only `childObject`; the relationship
FK and grid columns are derived from the child object's metadata (override via
`relationshipField` / `columns`). Renderer support: ObjectForm already renders
`subforms` (objectui), and the ObjectView form path passes them through.
