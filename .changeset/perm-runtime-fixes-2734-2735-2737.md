---
"@objectstack/driver-sql": patch
"@objectstack/objectql": patch
---

Three permission-runtime fixes found dogfooding the ADR-0090 showcase zoo:

**#2734 — driver tenant wall hid every global row.** `applyTenantScope` used
strict `organization_id = :tenantId` equality, so any caller with an active
org (every logged-in admin) saw ZERO rows in the org-less platform tables
(`sys_position`, `sys_permission_set`, `sys_business_unit` — Setup → Access
Control rendered empty on a fresh deployment) and none of the first-boot
seeds (stamped before the default org exists). The scope is now
`(organization_id = :tenantId OR organization_id IS NULL)`: a NULL tenant
column marks a GLOBAL/platform row that belongs to no other tenant; rows
stamped with a DIFFERENT org stay invisible exactly as before.

**#2735 — bulkCreate skipped write-side marshaling.** The batch insert path
(the common case for seeds/imports since #2678) handed raw object values
(`location`/`json`/`array` fields) to the SQLite binder — "Wrong API use:
tried to bind a value of an unknown type" — silently failing whole seed
batches (showcase accounts/tasks/field-zoo seeded zero rows). `bulkCreate`
now runs each row through the same `formatInput` + `applyWriteColumnMap` +
timestamp-stamp sequence as `create()`, and decodes the read-back the same
way.

**#2737 — count()/aggregate() ignored injected read filters.** `engine.count`
and `engine.aggregate` built a LOCAL ast inside the executor, discarding the
RLS/OWD filters the security and sharing middlewares inject into
`opCtx.ast.where` — `GET /data/:object` returned scoped `records` with an
UNSCOPED `total` (a row-count oracle over invisible records, broken
pagination). Both now carry their ast on the opCtx exactly like `find()`.
