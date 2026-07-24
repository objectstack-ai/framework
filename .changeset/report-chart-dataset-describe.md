---
"@objectstack/spec": patch
---

docs(spec): correct ReportChart `xAxis`/`yAxis` semantics; mark dead report surface (#1890)

Closes the report residual of the ADR-0021 analytics migration (#1890). The
dataset-bound report chart already renders — objectui's `DatasetReportRenderer`
plots `chart.xAxis`/`yAxis` as the bound dataset's **dimension**/**measure** via
`useDatasetRows`, and the Studio `ReportDefaultInspector` picks them from the
dataset's dimension/measure catalogs — but the spec `.describe()` still called
them raw "Grouping field" / "Summary field", misleading an author (or AI) into
naming object fields instead of dataset dimension/measure names.

- `ReportChart.xAxis`/`yAxis` describe now states they are dataset
  dimension/measure names (matching the live renderer + inspector).
- `ReportChart.groupBy` marked `[EXPERIMENTAL — not enforced]` — the
  dataset-bound renderer plots a single `xAxis`×`yAxis` series and never reads
  it; only the legacy `ReportViewer` fallback did.
- `ReportColumnSchema` / `ReportGroupingSchema` marked `@deprecated` — the
  single-form report shape expresses columns/grouping as dataset
  measure/dimension name arrays, so these objects are unreferenced; they remain
  only as public type exports (objectui re-exports them) pending a governed
  prune.

Docs regenerated (`ui/report.mdx`). No shape or parse-behavior change; no
export removed.
