---
"@objectstack/spec": minor
---

Extend `GanttConfigSchema` (ListView `gantt` config) to expose the full set of fields the Gantt renderer already supports, so the metadata pipeline preserves them end-to-end instead of stripping them at the spec boundary.

New optional fields: `colorField`, `parentField` (multi-level row tree — 项目 → 产品 → 排产计划 → 派工单), `typeField` (task / summary-folder / milestone row shape), `tooltipFields`, `baselineStartField` / `baselineEndField` (planned-vs-actual), `groupByField`, `resourceView` + `assigneeField` / `effortField` / `capacity` (resource-workload histogram), `quickFilters`, and `autoZoomToFilter`. The original five fields are unchanged; all additions are optional so existing Gantt views validate as before.
