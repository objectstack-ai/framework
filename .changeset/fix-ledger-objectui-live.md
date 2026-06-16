---
---

fix(spec): correct 9 field liveness classifications that were wrongly marked `dead`. They are LIVE via objectui renderers (verified against ../objectui): `externalId`, `currencyConfig`, `searchable`, and the master-detail/related-list overrides `inlineTitle`/`inlineColumns`/`inlineAmountField`/`relatedList`/`relatedListTitle`/`relatedListColumns`. The 2026-06 liveness audit's renderer-side verdicts were unreliable (objectui not re-checked); pruning these would have broken detail-page rendering. Ledger/process now include objectui. No prune.
