---
"@objectstack/plugin-org-scoping": minor
---

feat(org-scoping): hand a default org's seeded records to its admin (multi-tenant ownership handoff)

The multi-tenant companion to plugin-security's single-tenant `claimSeedOwnership`.
Seeded rows land `owner_id` NULL (the author leaves it unset; `cel`os.user.id``
resolves to NULL at seed time). In multi-tenant mode `claimOrphanOrgRows`
back-fills their `organization_id`, but `owner_id` stayed NULL — so "My" views,
owner reports and owner notifications were empty for the org's members.

- New `claimOrgSeedOwnership(ql, organizationId, ownerUserId)` — assigns
  `owner_id = ownerUserId` to an org's NULL-owned seed rows. Scoped to a single
  org (never touches another tenant), idempotent, skips `managedBy` / `sys_*`,
  and requires both `owner_id` and `organization_id` columns.
- `ensureDefaultOrganization` now calls it after binding the platform admin as
  the default org's owner, so the default org's demo data is owned by the admin
  out of the box — symmetric with the single-tenant first-admin handoff.
