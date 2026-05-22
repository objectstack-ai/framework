---
'@objectstack/studio': patch
---

Fix multiple live-preview rendering bugs surfaced by end-to-end browser
verification:

- **Grid empty render** – `@object-ui/plugin-grid` serialises `sort:[{field,order}]`
  into a space-delimited `$orderby` string which `@object-ui/data-objectstack`
  then iterates with `Object.entries()` (character indices), producing
  `sort=0,1,2,…` and zero records. The Studio data-source adapter now
  intercepts and repairs malformed `$orderby` before it reaches the server.
- **`listViews` sub-tabs** – `MetadataPreview` now discovers and renders tab
  entries from a view's `listViews.*` map in addition to top-level keys
  (`grid`, `kanban`, `calendar`, `form`, …), labels resolved from
  `spec.label` with sensible defaults.
- **Kanban schema transform** – CRM-style specs nest grouping under
  `kanban.{groupByField, columns}` and carry a `data:{provider,object}`
  block. `MetadataPreview` now promotes `groupByField → groupBy`, exposes
  card fields, and strips the `data:` field that would otherwise cause
  `@object-ui/plugin-kanban` to treat it as pre-fetched records and skip
  its data fetch entirely.
- **Calendar schema transform** – Analogous: promote
  `calendar.{startDateField, endDateField, titleField, colorField}` to
  the schema root and drop the `data:` provider block so the calendar
  fetches real records.
