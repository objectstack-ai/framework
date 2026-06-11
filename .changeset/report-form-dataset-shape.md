---
"@objectstack/spec": patch
---

reportForm now matches the 9.0 dataset-bound ReportSchema (ADR-0021): the authoring form declares `dataset` / `values` / `rows` / `runtimeFilter` instead of the removed query-form fields (`objectName` / `columns` / `groupingsDown` / `groupingsAcross` / `filter`), so editors no longer offer fields the schema strips at parse time.
