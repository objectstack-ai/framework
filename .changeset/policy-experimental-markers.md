---
"@objectstack/spec": patch
---

chore(spec): mark every PolicySchema property `[EXPERIMENTAL — not enforced]` (ADR-0049, #1882). PolicySchema (password/network/session/audit + `forceMfa`, IP allow-list, retention) is parsed but has no runtime consumer — `better-auth` runs hardcoded defaults. The per-property markers make the no-op explicit in the generated reference docs (previously `forceMfa` read "Require 2FA for all users" with no caveat — a false-compliance signal) and to the spec-liveness gate, which now classifies them `experimental` rather than `dead`. Description-only; no behaviour change.
