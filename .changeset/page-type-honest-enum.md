---
"@objectstack/spec": patch
---

ui(page): page `type` is the page kind, not a visualization

Removed `grid` / `kanban` / `calendar` / `gallery` / `timeline` from `PageTypeSchema`. They are visualizations of a `list` (interface) page — configured via `interfaceConfig.appearance.allowedVisualizations` and switched at runtime — never distinct page kinds. The runtime never branched on them as page types (it always read the visualization from `interfaceConfig`), so they only misled authors (e.g. selecting page type "kanban" did nothing). `VisualizationTypeSchema` is unchanged and remains the home for those values.

The roadmap interface kinds (`dashboard`, `form`, `record_detail`, `record_review`, `overview`, `blank`) stay valid in the schema but the page authoring form (`page.form.ts`) now offers only the kinds with a dedicated renderer — `list`, `record`, `home`, `app`, `utility` — with explicit labels, so the dropdown stops presenting dead options.
