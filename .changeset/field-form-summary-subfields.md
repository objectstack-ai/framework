---
'@objectstack/spec': patch
---

fix(spec): declare `summaryOperations` sub-fields in the Field metadata form (#3257)

`fieldForm` (the registered metadata form for editing a Field) previously
declared `summaryOperations` as a bare `composite` with no sub-fields, so a
protocol-driven renderer had to fall back to a raw JSON editor. It now declares
the inner shape explicitly — `object` (`ref:object`), `function` (select),
`field`, `relationshipField`, and `filter` (bound to `widget: 'filter-condition'`)
— mirroring the `summaryOperations` Zod schema and surfacing the roll-up `filter`
added in #1868. Also gates the block to `data.type == 'summary'`.

Small step toward #3257 (making the Studio field designer metadata-driven rather
than hand-coded); the live objectui inspector already edits these fields.
