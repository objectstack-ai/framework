---
"@objectstack/spec": minor
---

feat(spec): `ActionParamSchema` gains optional widget config — `multiple`, `accept`, `maxSize`

The console now renders action params through the same field-widget renderer
the record form uses (objectui#2700, objectui ADR-0059), so inline params can
declare the widget config the form widgets consume: `multiple` (array value
shape, mirrors `FieldSchema.multiple`), and the upload constraints `accept`
(MIME types / extensions) and `maxSize` (bytes) for `file`/`image` params.
Field-backed params (`{ field }`) keep inheriting these from the referenced
field at runtime; inline values override. Purely additive — no existing
schema changes shape.
