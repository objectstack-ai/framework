---
"@objectstack/service-analytics": minor
---

Analytics dimensions now render human display labels instead of raw stored
values. A `select` dimension shows its option `label` (e.g. `Backlog` rather than
`backlog`), and a `lookup`/`master_detail` dimension shows the related record's
display name (e.g. an account's name rather than its FK id). `queryDataset`
resolves these server-side, so every dashboard/report chart benefits with no
frontend change. Date/number/string dimensions are unaffected, and unresolved
values are left as-is.
