---
"@objectstack/spec": patch
"@objectstack/objectql": patch
---

**Unify the developer-facing org identifier in JS hooks — `organizationId` is now the blessed name; `session.tenantId` becomes a deprecated alias (#3280).** The caller's active organization was surfaced to hook authors as `ctx.session.tenantId`, while everything else on the developer surface — the `organization_id` column, `current_user.organizationId` in RLS/sharing, and seed rows — already said `organization`. A hook author had to internalize the hidden equation `tenantId === organizationId` to move between surfaces. This is additive and non-breaking:

- **`ctx.session.organizationId`** is added as the blessed name; **`ctx.session.tenantId`** still carries the identical value but is marked `@deprecated` in its TSDoc. Both come from the same resolved `ExecutionContext.tenantId` (which the kernel derives from `session.activeOrganizationId`).
- **`ctx.user.organizationId`** is added to the ergonomic `user` shortcut, so a hook that needs "the current org to filter by" writes `ctx.user.organizationId` with zero relearning — matching `current_user.organizationId` (RLS) and the `organization_id` column. The engine now populates `ctx.user` (`{ id, email?, organizationId? }`) at every hook event that already carries a `session`; it stays `undefined` for system / unauthenticated writes.

**No behavior change and no breaking rename.** The generic driver-layer tenancy abstraction (`ExecutionContext.tenantId`, `DriverOptions.tenantId`, `SqlDriver.applyTenantScope`, `TenancyConfig.tenantField`) is deliberately untouched — that layer's isolation column is configurable and legitimately carries an *environment* id in per-environment (database-per-tenant) kernels. Hook-authoring docs now teach `organizationId` and distinguish the two isolation axes: **org row-scoping** (`organization_id`, shared DB) vs **environment / database-per-tenant** (`service-tenant`, `driver-turso`). Community edition never populates an org, so `organizationId` is `undefined` there.
