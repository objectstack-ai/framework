---
"@objectstack/metadata-protocol": minor
"@objectstack/plugin-security": minor
---

feat(security): two-doors separation for permission sets (ADR-0086 P2)

Splits who may change a permission set into two non-overlapping doors, enforced
at the data layer instead of by convention:

**块1 — the package door (publish-time materialization).**
`ObjectStackProtocolImplementation` gains a generic publish-time materializer
registry (`registerPublishMaterializer(type, fn)`). When a draft of a registered
type is published, its body is projected into a data-plane row and the result is
surfaced on the publish response as `materializeApplied` (best-effort, never
thrown — same contract as `seedApplied`). `promoteDraft` now returns the draft's
`packageId` so the materializer can stamp the owning package. `plugin-security`
registers a `permission` materializer that upserts the published set into
`sys_permission_set` with `managed_by:'package'` + `package_id` — so a set
authored through the studio package door (saved as a `permission` draft, then
published) lands in the admin surface with the exact provenance the boot seeder
already stamps, now on the runtime publish path too. The single-set upsert is
shared with `bootstrapDeclaredPermissions` (`upsertPackagePermissionSet`), so
both paths apply the same own-row / foreign-package / env-authored rules.

**块2 — the admin door (data-layer write gate).**
The security middleware now refuses any admin-door write
(`update`/`delete`/`transfer`/`restore`/`purge`) to a `sys_permission_set` row
with `managed_by:'package'`, and refuses an `insert` that forges
`managed_by:'package'`. The gate fails closed regardless of the caller's grants
(a platform admin with `modifyAllRecords` is blocked just the same), so it is a
real data-layer boundary rather than a UI hint. System/boot writes carry
`isSystem` and bypass the whole middleware, so the boot seeder and the publish
materializer are unaffected. Env-authored sets (`managed_by` `user`/`platform`
or absent) stay freely editable through the admin door — the two doors never
overwrite each other.
