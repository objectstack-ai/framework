---
"@objectstack/platform-objects": minor
---

feat(identity): add an Org Chart tree view to `sys_business_unit`

`sys_business_unit` is already a self-referencing hierarchy
(`parent_business_unit_id`, ADR-0057 D2) but Setup only exposed flat grids. Adds
an `org_chart` list view (`type: 'tree'`) that renders the hierarchy as an
indented, expand/collapse tree-grid, listed first so it's the default tab. No
schema change — the parent pointer and graph traversal already existed; this only
surfaces them. The `active` / `inactive` / `by_kind` / `all` grids stay for
search, filter, and bulk edit.
