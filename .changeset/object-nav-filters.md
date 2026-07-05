---
'@objectstack/spec': minor
---

feat(spec): `ObjectNavItem.filters` — declarative URL filter conditions targeting the parameterized bare data surface (objectui ADR-0055, objectui#2251).

An object nav item can now carry `filters: Record<string, string>` (equality semantics). The shell resolves such an entry to `/:objectName/data?filter[<field>]=<value>` — an unanchored data surface with removable filter chips — instead of a saved list view. Use it for one-off / parameterized slices (dashboard drill-throughs, "assigned to me" links); slices worth curating stay on `viewName`. Values support the same `{current_user_id}` / `{current_org_id}` template variables as `recordId`. Target precedence within `type: 'object'`: `recordId` → `filters` → `viewName`. Purely additive — items without `filters` are unaffected.
