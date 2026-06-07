---
"@objectstack/spec": minor
"@objectstack/objectql": minor
---

Field-level conditional rules (CEL): `visibleWhen` / `readonlyWhen` / `requiredWhen`, enforced server-side.

Add three CEL-predicate field props (over `record`) evaluated on both sides. **Spec**: `visibleWhen` / `readonlyWhen` / `requiredWhen` (`requiredWhen` canonical; `conditionalRequired` kept as a back-compat alias). **Server (objectql)**: the validator now enforces `requiredWhen`/`conditionalRequired` over the merged record (so the rule can't be bypassed by a direct API write), and the update path ignores writes to a field whose `readonlyWhen` is TRUE (keeps the persisted value). `needsPriorRecord` accounts for conditional fields so the prior record is fetched on update.
