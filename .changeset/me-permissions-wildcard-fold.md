---
"@objectstack/plugin-hono-server": patch
---

fix(security): `/me/permissions` folds the `'*'` wildcard super-user grant into per-object FLS, matching server enforcement (ADR-0057 D10)

The `/api/v1/auth/me/permissions` per-object map merged each permission set's
explicit `objects` entries most-permissively per key, but treated `'*'` and
named objects as independent keys — so a wildcard "Modify/View All Data" grant
was never propagated into a per-object entry another set explicitly denied.
That made the client's field-level security STRICTER than the server's actual
enforcement (`PermissionEvaluator.checkObjectPermission` allows as soon as any
set grants, including via the `'*'` modifyAll/viewAll super-user bypass, with
no deny-wins).

Concretely: a platform admin (`admin_full_access` → `'*': {modifyAllRecords}`)
who also holds `organization_admin` (which denies writes on identity tables)
resolved to `sys_user.allowEdit:false` in this payload, so the Console disabled
the standard edit form — even though the server accepts the write (`PATCH
/data/sys_user {name}` → 200). The new `foldWildcardSuperUser` post-pass lifts
each per-object entry's read/write bits when the merged wildcard is a
super-user grant, so the client mirrors the server (never broader — the
super-user grant already covers private/managed objects server-side). This
unblocks the ADR-0092 D4 `sys_user` profile-edit affordance for platform
admins; the identity write guard still restricts the actual write to
`{name, image}`.
