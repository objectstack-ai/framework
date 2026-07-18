---
'@objectstack/spec': minor
---

refactor(spec): remove unenforced agent `visibility` field (ADR-0056 D8, #1901)

The agent `visibility` (`global`/`organization`/`private`) field is **removed**
from `AgentSchema`. It was never enforced: the chat-access evaluator excluded it
and the agent list route did not filter by it, so setting `private` never hid an
agent. Per ADR-0049 / ADR-0056 D8 ("design+enforce or remove"), a security-shaped
field with no runtime consumer is a liability — authors who set `private` believe
they've restricted an agent when they have not.

Unlike `field-encryption` (kept `[EXPERIMENTAL]` — it has a stable schema shape on
a real roadmap), correct `visibility` enforcement is undesigned: it needs
owner/org anchors that do not exist today. `agent.tenantId` was already removed
(#2377), agents carry no owner field, and the `EXTERNAL` posture rung is defined
but never derived — so `organization` vs `global` is runtime-indistinguishable.
The semantics, not just the plumbing, are unresolved, so the field is dropped
rather than carried marked.

- `AgentSchema` is not `.strict()`, so existing metadata that still sets
  `visibility` parses cleanly — the unknown key is stripped, not rejected.
- Use `access` / `permissions` to restrict who can use an agent — both **enforced**
  at the chat route (#1884).
- Re-introduce `visibility` when the agent listing surface gains real owner/org
  semantics; tracked in #1901.

Also updated: authoring form (`agent.form.ts`), liveness ledger
(`liveness/agent.json`), the ADR-0056 D10 authz-conformance matrix (moved from
`experimental` to `removed`), and the generated schema reference docs.
