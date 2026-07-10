---
"@objectstack/rest": minor
"@objectstack/plugin-security": minor
---

ADR-0090 D6 — the explain engine gets its REST face (#2696).

**`@objectstack/rest`**: new `GET/POST /api/v1/security/explain`
(`object`/`operation`/`userId`, validated against the spec's
`ExplainRequestSchema`) delegating to the `security` service's
`explain(request, callerContext)` — the same code paths the enforcement
middleware runs, so the returned `ExplainDecision` is explained by
construction. The route is authenticated-only (401 even on
`requireAuth=false` deployments), returns 501 when no security service
exposes `explain`, and maps the service's `PermissionDeniedError` to 403.
Registered on scoped (`/environments/:environmentId`) and unscoped base
paths; the env kernel's own `security` service is preferred, with a new
host-kernel `securityServiceProvider` fallback wired by the REST plugin.

**`@objectstack/plugin-security`**: `explainAccessForCaller` now honors
delegated administration (D12) — explaining ANOTHER user is authorized by
`manage_users` **or** a delegated `adminScope` whose business-unit subtree
covers the target user (new `DelegatedAdminGate.scopesCoverUser`, fail-closed
on unresolvable scopes/memberships). Self-explain still needs neither.
