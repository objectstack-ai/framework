---
'@objectstack/objectql': patch
---

fix(metadata): stamp a top-level `name` on `view` bodies at the write path so AI/hand-authored views surface

`getMetaItems` only overlays a `sys_metadata` row when its parsed body has a top-level `name`. Some view producers — notably loose `{ list: <ListView> }` / `{ form: … }` fragments that AI tools and hand-authoring emit — pass schema validation but carry no top-level `name`, so the view was silently dropped from the object's view list and never appeared as a tab ("validates ≠ surfaces").

`saveMetaItem` now guarantees a top-level `name` on every view body at the single write chokepoint, BEFORE validation + persistence, so a nameless view is auto-corrected regardless of which authoring path produced it. It deliberately does NOT reshape the document: both the `defineView` container form (`{ list, listViews, … }`, expanded by the loader) and the `{ name, object, viewKind, config }` record form are valid and the console consumes both — reshaping a container into a record risks producing an invalid record (e.g. a non-`<object>.<key>` name) and drops Studio-only fields (`isPinned`, `sortOrder`, …). Exported as `normalizeViewMetadata` and unit-tested.

(Note for follow-up: the `view` metadata schema is itself a permissive union — it accepts an unknown `viewKind`, a kanban config missing `groupByField`, even `{}`. Tightening it correctly requires first consolidating the four legitimate view shapes — record / container / flat list / flat form — and is a separate spec change.)
