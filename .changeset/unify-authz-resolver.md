---
"@objectstack/rest": patch
"@objectstack/runtime": patch
"@objectstack/core": patch
---

fix(security): single-source the request authorization resolver — REST no longer drops sys_user_role

The REST server and the runtime dispatcher each carried their own copy of the request → ExecutionContext identity/role resolver, and they drifted on a security path. The REST copy silently omitted `sys_user_role` (so custom roles granted via the ADR-0057 D4 platform-RBAC path did not apply over REST), `sys_role_permission_set`, the `owner→org_owner` membership normalization, the platform-admin derivation, and the `ai_seat` synthesis — fail-closed (legitimate access denied), not an escalation.

Both entry points now delegate to a single shared resolver, `resolveAuthzContext` in `@objectstack/core/security` (joining the API-key verifier that already lived there). A contract test locks every authorization source and a lint gate (`check:authz-resolver`) prevents a future duplicate resolver or a dropped delegation.
