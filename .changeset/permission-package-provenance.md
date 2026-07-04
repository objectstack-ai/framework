---
"@objectstack/spec": minor
"@objectstack/plugin-security": minor
---

feat(security): permission-set package provenance + declared-permission seeding (ADR-0086 P1)

Packages now ship working default access for their own objects, with a
machine-checkable metadata↔config boundary:

- **Spec (ADR-0086 D3)**: `PermissionSetSchema.packageId` (owning package for
  a package-shipped set; absent = env-authored) and per-record provenance
  `managedBy: 'package' | 'platform' | 'user'` on the existing
  metadata-persistence axis. Persisted on `sys_permission_set` as
  `package_id` / `managed_by` (new columns + `package_id` index).
- **Seeding (ADR-0086 D5)**: new `bootstrapDeclaredPermissions` — the sibling
  of `bootstrapDeclaredRoles` — materializes `stack.permissions` into
  `sys_permission_set` at boot with `managed_by:'package'` + `package_id`.
  Idempotent and upgrade-aware: rows the seeder owns are re-seeded to the
  shipped declaration on every boot; rows owned by a different package are
  refused loudly; env-authored `platform`/`user`/legacy rows are never
  clobbered. Closes the ADR-0078 inert-metadata violation for
  `stack.permissions` (declared sets were runtime-enforced but never
  materialized — invisible to the admin surface, uninstall undefined).
- Conformance matrix row `declarative-permission-seeding` (ADR-0056 D10) +
  dogfood proof pin the behavior so it cannot regress to inert.
