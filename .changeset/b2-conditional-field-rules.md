---
"@objectstack/spec": minor
---

Field-level conditional rules (CEL): `visibleWhen` / `readonlyWhen` / `requiredWhen`.

Add three CEL-predicate field props evaluated on both sides — the client form toggles a field's visibility / read-only / required state live as the record changes, and the server enforces them (can't be bypassed). `requiredWhen` is the canonical name; the existing `conditionalRequired` is kept as a back-compat alias.
