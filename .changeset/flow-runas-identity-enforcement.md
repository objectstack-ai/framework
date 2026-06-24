---
'@objectstack/spec': minor
'@objectstack/service-automation': minor
'@objectstack/runtime': minor
'@objectstack/trigger-record-change': minor
---

fix(security): enforce flow `runAs` execution identity (#1888)

The `service-automation` engine now honors `flow.runAs` instead of ignoring it.
Previously the CRUD nodes passed **no identity** to ObjectQL, so the security
middleware was skipped entirely — every flow ran effectively elevated regardless
of `runAs`. A `runAs:'user'` flow did **not** de-elevate (a privilege-boundary
surprise), and `runAs:'system'` did not *explicitly* elevate.

The engine now establishes the run's data-layer identity at setup and restores
the caller's context afterward:

- **`runAs:'system'`** → an elevated, RLS-bypassing system principal
  (`{ isSystem: true }`): the run can read/write records the triggering user
  cannot.
- **`runAs:'user'`** (default) → the **triggering user's** identity
  (`{ userId, roles, permissions, tenantId }`): CRUD nodes' ObjectQL reads/writes
  respect that user's row-level security, and the run can never exceed the
  triggering user's grants.

To keep `runAs:'user'` faithful to a direct request by that user, the REST
trigger route (`@objectstack/runtime`) and the record-change trigger
(`@objectstack/trigger-record-change`) now forward the caller's resolved
`roles`/`tenantId` into the `AutomationContext` (new optional fields), not just
`userId`. The new `resolveRunDataContext` helper is the single place that maps a
run's effective `runAs` to the ObjectQL context, shared by every data node.

The `[EXPERIMENTAL — not enforced]` marker is removed from `FlowSchema.runAs`.

**Behavior change / migration.** Flows that previously relied on the implicit
elevation (the default `runAs:'user'` ran unscoped) now run as the triggering
user and are subject to their RLS. **Declare `runAs:'system'` on any flow that
must read or write beyond the triggering user's access** (e.g. system
automations, cross-owner roll-ups). Schedule-triggered runs have no trigger user;
under `user` they stay unscoped (there is no identity to scope to) — declare
`system` to make elevation explicit.

Proven both directions by the dogfood regression gate
(`flow-runas.dogfood.test.ts` — a restricted member triggers system vs user
flows against an owner-scoped record) and service-automation unit + regression
tests (`crud-runas.test.ts`).
