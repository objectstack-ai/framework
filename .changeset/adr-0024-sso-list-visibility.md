---
'@objectstack/platform-objects': patch
---

Auth: make the SSO Providers list visible to admins (ADR-0024 / cloud#551)

The `sys_sso_provider` Setup list rendered empty even after an admin registered a provider: `member_default`'s wildcard `tenant_isolation` RLS (`organization_id == current_user.organization_id`) denied every row, because better-auth writes these via its adapter with no tenantId context so `organization_id` is never stamped, and the platform-admin `viewAllRecords` superuser bypass is gated to private/non-tenant objects.

`sys_sso_provider` is env-global, admin-only identity config, so it now declares:
- `tenancy: { enabled: false }` — opts out of multi-tenancy (the env IS the tenant; providers are env-wide), letting a platform admin's `viewAllRecords` bypass see every provider.
- `requiredPermissions: ['manage_platform_settings']` — object-level capability gate so ordinary members are denied (without it, tenancy-disabled + `member_default`'s `'*': allowRead` would expose providers to every authenticated user).

Verified E2E: an admin sees all env providers in the Setup → Access Control → SSO Providers list; a non-admin gets 403. (Env-only object — no control-plane cross-tenant impact. The sibling `sys_oauth_application` / `sys_account` nav entries share the same empty-list symptom but span the control plane and need separate per-object analysis.)
