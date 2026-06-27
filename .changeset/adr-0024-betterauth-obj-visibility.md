---
'@objectstack/plugin-security': patch
---

Security: platform admins see all rows of better-auth-managed identity objects (ADR-0024 / cloud#551)

Identity tables managed by the auth library (`managedBy: 'better-auth'` — `sys_oauth_application`, `sys_account`, `sys_session`, `sys_sso_provider`, …) are written by better-auth's own adapter with **no tenant context**, so `organization_id` is never stamped and `member_default`'s wildcard `tenant_isolation` RLS denies every row — a platform admin's Setup list (OAuth Applications, Identity Links, …) renders **empty**.

These objects now get the **same posture-gated superuser bypass** as `private` / `tenancy.enabled:false` objects, so a platform admin's `viewAllRecords` sees all identity rows env-wide. This is **admin-only**: non-admins never trigger the bypass — their `_self` carve-outs / `tenant_isolation` still apply (verified by a regression test that a member stays tenant-scoped), and the flag is deliberately **not** used for the wildcard-policy drop, so it can never leak rows to members.

Fixes the empty-list symptom across all better-auth-managed Setup objects without per-object `tenancy` changes (which would risk the control plane, where some of these objects ARE cross-env-isolated).
