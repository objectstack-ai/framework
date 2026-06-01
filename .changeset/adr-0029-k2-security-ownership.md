---
"@objectstack/platform-objects": minor
"@objectstack/plugin-security": minor
"@objectstack/plugin-sharing": minor
---

ADR-0029 K2 — security domain ownership (RBAC + sharing) + Setup nav contributions.

Moves the security objects out of the `@objectstack/platform-objects` monolith
into the two capability plugins that already register and operate them, split by
concern (the two are orthogonal — sharing objects never reference RBAC objects):

- **`@objectstack/plugin-security`** (RBAC) gains `sys_role`,
  `sys_permission_set`, `sys_user_permission_set`, `sys_role_permission_set`,
  and the `defaultPermissionSets` seed (which its `bootstrap-platform-admin`
  already consumes). The RBAC + default-permission-set tests move with them.
- **`@objectstack/plugin-sharing`** gains `sys_record_share`,
  `sys_sharing_rule`, `sys_share_link`.
- `@objectstack/platform-objects` no longer defines/exports any security
  objects; the `/security` subpath is now an empty barrel. Runtime is unchanged
  (both plugins already registered these objects at runtime).

**D7 navigation** — the Setup app's `group_access_control` is now assembled from
three sources: `plugin-security` contributes Roles / Permission Sets (priority
100), `plugin-sharing` contributes Sharing Rules / Record Shares (priority 200),
and `platform-objects` keeps only API Keys (`sys_api_key`, an identity object,
priority 300) — preserving the original menu order.

**i18n (D8)** — the objects are removed from the `platform-objects` i18n extract
config; existing generated bundles keep working at runtime (object-name keyed).
Migrating the i18n extraction to the owning plugins remains the tracked
follow-up.
