---
"@objectstack/service-analytics": minor
---

Analytics drill metadata now snapshots raw grouped values for totals/subtotal rows too (#3214). The ADR-0021 D2 drill sidecar (`drillRawRows`, #2080) only covered `result.rows`, but the totals rows added in #1753 carry dimension values and go through the same label resolution — which overwrote their stored value (select option value, lookup/master_detail FK id) with the display label, leaving a subtotal drill nothing to exact-match on.

`queryDataset` now also emits `drillRawTotals`, aligned to `result.totals` by index (`drillRawTotals[i][j]` ↔ `result.totals[i].rows[j]`), captured in the same pre-label-resolution pass. Each map is restricted to the drillable dimensions the grouping actually groups by, so the grand-total grouping (`[]`) contributes an empty map per row. Purely additive result props (same as #2080) — no spec-contract change.
