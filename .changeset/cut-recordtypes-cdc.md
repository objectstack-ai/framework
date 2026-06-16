---
---

chore(spec): remove the orphaned `object.recordTypes` and `object.cdc` properties from `ObjectSchema`. Both were spec-only stubs with elaborate docstrings and zero consumers in either repo (framework runtime + objectui authoring/rendering): `recordTypes` (Salesforce-specific concept — the platform models record variants via a discriminator field + conditional layouts / form variants) and `cdc` / `CDCConfigSchema` (aspirational enterprise change-data-capture — low-code change propagation is served by webhooks + triggers). Removes false surface from the metadata contract; both were classified `dead` in the liveness ledger. No package version impact.
