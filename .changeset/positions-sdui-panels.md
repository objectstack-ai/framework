---
"@objectstack/spec": minor
"@objectstack/platform-objects": minor
"@objectstack/plugin-security": minor
---

Position assignment panels as pure SDUI (ADR-0090 follow-through).

- `RecordRelatedListProps` gains `relationshipValueField` (default `'id'`): which parent-record field the junction's `relationshipField` stores — the generic affordance for name-keyed junctions (`sys_user_position.position` stores `sys_position.name`). Used for both the list filter and the Add-picker's parent-side value.
- `sys_user` detail page gains a **Positions** tab (assign positions to a user; Add picker stores the position machine name via `valueField: 'name'`; the D12 delegated-admin gate's denials surface in the dialog).
- New `sys_position` detail page (shipped by plugin-security): **Holders** (name-keyed via `relationshipValueField: 'name'`) and **Permission Sets** (bindings) tabs — zero bespoke UI; ADR-0091 validity columns slot in later as plain column additions.

Renderer note: the generic `record:related_list` Add-picker and `relationshipValueField` support land in objectui alongside the ^14 alignment; with older renderers these tabs degrade to read-only lists.
