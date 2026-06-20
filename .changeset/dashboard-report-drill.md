---
"@objectstack/service-analytics": minor
---

Dataset analytics enrich **dimension** result fields with their display label (so report/dashboard table headers read "Status" instead of the raw field name) and expose drill-through metadata on the dataset query result: the base `object`, a drillable dimension→field map, and a parallel `drillRawRows` array of each row's raw grouped values (captured before label resolution). This lets a host drill a grouped bucket back to its underlying records with an exact-match filter built from the stored value, not the display label. Date dimensions are excluded (a humanized bucket can't be exact-matched).
