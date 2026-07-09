---
'@objectstack/spec': minor
---

BREAKING (pre-launch): remove the three declared-but-never-enforced compliance
subsystems per ADR-0056 D8 ("design + enforce, or remove"), and mark the AI
agent `visibility` property EXPERIMENTAL (#1901).

Removed — none of these were read by any runtime path, and compliance-grade
configuration must never merely look live:

- `ComplianceConfigSchema` / `GDPRConfigSchema` / `HIPAAConfigSchema` (and the
  rest of `system/compliance.zod.ts`) — there is no data-subject-rights engine,
  retention enforcer, or BAA gate. FROM `import { ComplianceConfigSchema } from
  '@objectstack/spec/system'` TO: delete the reference — a real compliance
  subsystem will be designed top-down when scheduled.
- `MaskingConfigSchema` / `MaskingRuleSchema` (`system/masking.zod.ts`) — no
  redaction layer applies them. FROM masking config TO: field-level security
  (permission-set field rules, enforced by plugin-security's field masker); a
  subtractive masking/deny layer arrives with ADR-0066 ⑦/⑧ if needed.
- `RLSConfigSchema` / `RLSAuditEventSchema` / `RLSAuditConfigSchema`
  (`security/rls.zod.ts`) — the enforced RLS path never read the global config.
  FROM global `RLSConfig` TO: per-policy `RowLevelSecurityPolicySchema` (the
  live, enforced surface — unchanged).

Kept, still `[EXPERIMENTAL]`: `EncryptionConfigSchema` (at-rest field
encryption) — a real enterprise roadmap item with a stable shape; carrying it
marked costs less than remove-and-re-add (ADR-0087).

Marked `[EXPERIMENTAL — NOT ENFORCED]` (#1901): `AgentSchema.visibility` — the
chat-access evaluator deliberately excludes it and the agent list route does
not filter by it, so `private` does not hide an agent. The schema description
and the authoring form now say so; use `access` / `permissions` (both enforced
at the chat route since #1884) for real gating. The ADR-0056 D10 conformance
matrix tracks all dispositions (`agent-visibility` experimental;
`compliance-configs` / `data-masking` / `rls-config-global` removed).
