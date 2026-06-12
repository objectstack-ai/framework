---
"@objectstack/spec": minor
"@objectstack/service-analytics": minor
---

Server-side totals for matrix reports (#1753). `queryDataset` selections accept `totals: { groupings: string[][] }` — each grouping a subset of `selection.dimensions` to additionally aggregate by (`[]` = grand total); the marginal rows come back on `AnalyticsResult.totals` in request order. Each subtotal/grand total re-runs the full executor pipeline (measure-scoped filters, derived measures, compareTo) grouped only by that subset, so totals use each measure's true aggregate over the underlying rows — an `avg` total is the average of all rows, never an average of bucket averages (the ADR-0021 line that forbids client-side re-aggregation). Dimension display labels resolve on totals rows the same as the primary grid. A matrix report renderer asks for `{ groupings: [rowDims, columnDims, []] }` and renders the supplied totals row/column.
