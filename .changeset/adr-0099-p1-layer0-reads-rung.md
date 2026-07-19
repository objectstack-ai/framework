---
'@objectstack/plugin-security': patch
---

ADR-0099 P1 (#3211 M2): the Layer 0 cross-tenant exemption gate now reads the carried `ctx.posture` rung (#2956) as authoritative, with the platform-admin capability probe demoted to a fallback for resolver-less contexts (delegated-admin bridge, sharing service, `getReadFilter`). The read and write (insert/update post-image) tenant checks share one decision (`computeLayeredRlsFilter`), so they cannot drift. A probe↔rung disagreement logs a defect breadcrumb and enforces the narrower rung verdict.

**Behavior change (security narrowing, multi-org / `@objectstack/organizations` only):** a principal whose carried rung is not `PLATFORM_ADMIN` no longer crosses the tenant wall on private / platform-global / better-auth-managed objects, even when its resolved permission sets carry a platform-exclusive capability. Two shapes are affected: (a) a **scoped** `admin_full_access` grant (`sys_user_permission_set.organization_id` non-null), and (b) a custom set granting a platform capability (e.g. `studio.access`) piecemeal alongside a superuser bit. Both are now walled to their own org — the fail-safe direction (the carried rung is a strict subset of the probe). Single-org / env-per-database deployments are unaffected (Layer 0 is inert).

**Upgrade check:** before upgrading, scan `sys_user_permission_set` for `admin_full_access` rows with a non-null `organization_id`, and custom permission sets whose `systemPermissions` intersect `{manage_metadata, manage_platform_settings, studio.access, manage_users}`. To restore cross-tenant operator access for such a principal, grant the **unscoped** `admin_full_access` instead. The `[authz/ADR-0099]` warn log names any principal hitting the divergence at runtime.
