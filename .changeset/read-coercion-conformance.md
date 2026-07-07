---
"@objectstack/verify": minor
---

Add `checkReadCoercion` — a reusable, driver-agnostic read-coercion conformance
helper (a stored value must read back as its declared type: boolean as boolean,
json as object, integer as number). Mirrors `checkLedger`: returns a list of
problems (empty = conformant) with no test-runner dependency, so any driver —
including out-of-tree ones like cloud's driver-turso — can run the identical
contract against itself. This is the invariant behind the case_escalation
`1 != true` incident.
