---
"@objectstack/spec": major
"@objectstack/objectql": major
"@objectstack/runtime": major
"@objectstack/trigger-record-change": patch
---

**BREAKING: remove the deprecated `ctx.session.tenantId` / `ctx.user.tenantId` alias from the hook & action authoring surface — converge on `organizationId` (#3290).**

#3280 made `organizationId` the blessed developer-facing name for the caller's active org across the JS authoring surface and kept `tenantId` as a `@deprecated` alias carrying the identical value. That alias is now **removed** from the hook `ctx.session`, the action-body `ctx.session`, and the action-body `ctx.user`. Read the caller's active org under the single blessed name:

```diff
- const org = ctx.session.tenantId;   // hook or action body
+ const org = ctx.user?.organizationId ?? ctx.session?.organizationId;
```

**FROM → TO migration** (in any `*.hook.ts` / `*.action.ts` body):

- `ctx.session.tenantId` → `ctx.session.organizationId`
- `ctx.user.tenantId` (action body) → `ctx.user.organizationId`

The value is unchanged — `organizationId` is the same active-org id, matching the `organization_id` column and `current_user.organizationId` in RLS/sharing. `ctx.user` is `undefined` for system / unauthenticated writes, so read `ctx.session?.organizationId` when a hook or action must work regardless of a resolved user.

What changed internally:

- **`@objectstack/spec`** — `HookContextSchema.session` drops the `tenantId` field (only `organizationId` remains). A stray `tenantId` on a constructed session is now stripped by the schema.
- **`@objectstack/objectql`** — the engine's `buildSession()` no longer emits `session.tenantId`; the audit-stamp plugin sources the `tenant_id` column from `session.organizationId`.
- **`@objectstack/runtime`** — `buildActionSession()` and the REST action `ctx.user` no longer emit `tenantId`.
- **`@objectstack/trigger-record-change`** — reads `session.organizationId` (was `session.tenantId`) when forwarding the writer's org to a `runAs:'user'` flow; behavior is identical.

**Explicit non-goal (unchanged):** the generic **driver-layer** tenancy abstraction is *not* touched — `ExecutionContext.tenantId`, `DriverOptions.tenantId`, `SqlDriver.applyTenantScope` / `TenancyConfig.tenantField`, and `ExecutionLog.tenantId`. That isolation column is configurable and legitimately carries an *environment* id in database-per-tenant kernels; it is a distinct axis from the developer-facing org. The build-time `check:org-identifier` guard now also covers `packages/**` to keep reference bodies off the removed name.
