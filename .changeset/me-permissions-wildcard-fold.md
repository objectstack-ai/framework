---
"@objectstack/plugin-hono-server": patch
---

fix(security): `/me/permissions` now reflects permission-set ∩ identity-write-guard, matching real server enforcement (ADR-0057 D10)

The `/api/v1/auth/me/permissions` per-object map merged each permission set's
explicit `objects` entries most-permissively per key, but treated `'*'` and
named objects as independent keys — so a wildcard "Modify/View All Data" grant
was never propagated into a per-object entry another set explicitly denied.
That made the client's field-level security STRICTER than the server's actual
enforcement (`PermissionEvaluator.checkObjectPermission` allows as soon as any
set grants, including via the `'*'` modifyAll/viewAll super-user bypass, with
no deny-wins).

The real effective answer for a user-context caller is `permission-set grant ∩
identity-write-guard policy`, and the payload now computes both:

1. `foldWildcardSuperUser` lifts each per-object entry's read/write bits when
   the merged `'*'` is a super-user grant — fixing the false-NEGATIVE where a
   platform admin (`admin_full_access` `'*': {modifyAllRecords}`) who also holds
   `organization_admin` (explicit identity denies) resolved to
   `sys_user.allowEdit:false` and a disabled edit form, though the server
   accepts the write (`PATCH /data/sys_user {name}` → 200).
2. `clampManagedObjectWrites` re-clamps `managedBy: 'better-auth'` objects by
   their write affordance — fixing the false-POSITIVE the fold would otherwise
   introduce: the identity write guard (ADR-0092 D2) blocks user-context writes
   on identity tables except where the object opted in (`userActions.edit`), so
   `sys_member` / `sys_account` / `sys_session` stay `allowEdit:false` for the
   admin (read stays granted). Only `better-auth` objects are clamped — the
   guard covers only them; `system`/`config`/`append-only` objects have no such
   guard and their permission-set result stands.

Net: the Console's per-object FLS now equals real server enforcement — the
ADR-0092 D4 `sys_user` profile-edit affordance is unblocked for platform admins
(the guard still narrows the write to `{name, image}`), and no other identity
table is shown as editable when the guard would reject it.
