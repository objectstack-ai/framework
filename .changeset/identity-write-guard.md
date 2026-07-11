---
"@objectstack/plugin-auth": minor
---

feat(auth): identity write guard — `managedBy: 'better-auth'` is now enforced at the engine (ADR-0092 D2/D3/D6)

Every object whose schema declares `managedBy: 'better-auth'` (`sys_user`,
`sys_member`, `sys_session`, `sys_api_key`, …) is now protected by engine
`beforeInsert` / `beforeUpdate` / `beforeDelete` hooks registered by
plugin-auth: **user-context** writes through the generic data path are
rejected fail-closed with `403 PERMISSION_DENIED`, closing the hole where a
wildcard admin permission set could raw-write any identity column (including
`email` and credential stamps) via the data API. Internal writes are
unaffected — the better-auth adapter, `isSystem` plugin/system contexts, and
the identity import keep working unchanged.

The only opening is a per-object update whitelist
(`registerManagedUpdateWhitelist(object, fields)`): non-whitelisted fields are
stripped from the payload, and a payload that strips to nothing throws. The
first registration ships here: `sys_user → { name, image }` (pure profile
fields), backed by the new shared `SYS_USER_PROFILE_EDIT_FIELDS` /
`SYS_USER_IMPORT_UPDATE_FIELDS` constants — the import upsert's field
discipline is now derived from the same module (subset-by-construction, no
drift).

After a guarded profile edit, an `afterUpdate` companion hook re-writes the
user's cached `{session, user}` snapshots in better-auth's secondary storage
(same TTL, mirror of better-auth's own `refreshUserSessions`) so session
reads stay coherent; it rewrites rather than deletes, and no-ops when no
secondary storage is wired.

Migration note: server-side scripts that previously updated identity tables
with a **user** execution context must either run with a system context
(`{ isSystem: true }`) if they are genuinely internal, or move to the
dedicated auth endpoints (invite / create-user / set-user-password / ban /
better-auth APIs). Flows and automations that wrote non-profile `sys_user`
columns under a user identity are now filtered the same way.
