---
'@objectstack/platform-objects': minor
'@objectstack/plugin-auth': minor
'@objectstack/runtime': minor
---

Auth: per-org MFA + dispatcher/MCP gate — complete the ADR-0069 enforced-MFA story

Two follow-ups that make enforced MFA total:

- **Per-org `sys_organization.require_mfa`** — an org may require MFA above the global floor. `computeAuthGate` now treats the active org's `require_mfa` as an effective MFA requirement even when the global `mfa_required` is off; `isAuthGateActive()` stays cheap via a 60s-TTL "any org requires MFA" cache (lazy background refresh), so a brand-new per-org requirement activates the gate on the next request without per-request org queries.
- **Dispatcher/MCP gate** — the auth-policy gate now also runs in the runtime dispatcher (after `resolveExecutionContext`), so MCP / GraphQL / embedded data paths enforce `PASSWORD_EXPIRED` / `MFA_REQUIRED` consistently with the REST seam (reusing the shared `evaluateAuthGate` allow-list). Previously only the REST surface (the Console) was gated.

Default-off / additive. Per ADR-0049 each setting ships with its enforcement.
