---
'@objectstack/plugin-security': minor
'@objectstack/plugin-sharing': minor
---

ADR-0090 D10 — agent/service intersection runtime. When a request's principal acts `onBehalfOf` a user (an AI agent or a service acting for a person), the effective permission is now the INTERSECTION of the principal's own grants and the delegator's grants — never the union. Confused-deputy prevention: an over-privileged agent may never see or touch anything the user it stands in for could not, and vice-versa. Previously `principalKind:'agent'` / `onBehalfOf` was a P1 context shape the evaluator did not read.

The intersection is applied at EVERY axis, gated on the presence of the delegation link so the ordinary (non-delegated) path is byte-identical:

- **plugin-security** middleware — the delegator's effective permission sets are reconstructed once (fail-CLOSED if the delegator no longer exists — a dangling link is denied, not resolved to the additive baseline) and AND-composed into: the required-capability gate, object CRUD, field-level security (read mask + write forbid + predicate-oracle guard), the row-level `using` pre-image on by-id writes, the `check` post-image, and the RLS read-filter injection. View/Modify-All only survives when BOTH principals hold it.
- **plugin-sharing** middleware — the OWD/record-sharing owner-match is IDENTITY-scoped, so it re-runs the visibility filter (and `canEdit`) under the delegator's own identity + depth and AND-s it in. An agent with View-All acting on behalf of a plain member therefore sees exactly that member's own rows — not everyone's, and not nothing.
- **explain engine** — every layer reports the narrower verdict when `onBehalfOf` is set, so the D6 access explanation stays truthful for delegated principals; a dangling delegator is reported as a fail-closed deny.

First-cut scope (documented in code + covered by tests): one delegation hop (the `onBehalfOf` shape carries a single delegator, and any single-hop intersection is a safe lower bound on a true multi-hop chain); tenant-scoped substitution bags (`tenantId`, `org_user_ids`, `email`) are inherited from the live principal, while person-specific membership bags left unresolved narrow rather than widen. The agent grant-ceiling lint (D10 rule 2) is a follow-up — the runtime intersection already caps the agent regardless of what its own sets carry, and a lint needs an agent-set designation convention that does not yet exist.
