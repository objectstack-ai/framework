---
"@objectstack/verify": minor
---

ADR-0060 P1 — add the reusable conformance-ledger helper. `@objectstack/verify`
now exports `checkLedger(rows, opts)` + `ConformanceRow`: the static complement to
its runtime harness, encoding the shared invariants the platform had hand-written
twice (unique ids / valid state / enforced-has-site / experimental·removed-has-note
/ proof-file-exists / high-risk-has-proof / exactly-one-cover / discover ratchet).
The ADR-0056 authz and ADR-0058 expression ledgers are refactored onto it.
