---
"@objectstack/metadata-protocol": patch
"@objectstack/spec": patch
---

fix(metadata-protocol): strip static `readonly` on INSERT at the data-write ingress (#3043)

#2948/#3003 made static `readonly: true` fields server-enforced on UPDATE (a
non-system PATCH forging `approval_status: 'approved'` is silently stripped in
the engine), but INSERT was exempt. For approval/status/verdict columns that
exemption was the *shorter* attack: instead of the #3003 draft-then-PATCH move, a
non-system caller could `POST` a record already `approval_status: 'approved'` in
one step — and the UPDATE-only strip never reached it.

The strip now also runs on INSERT, but at the **external data-write ingress**
(`DataProtocol.createData` / `createManyData` / `batchData` / `cloneData`) rather
than in the engine. That seam is the single point every external programmatic
create funnels through — the REST CRUD route, the GraphQL/MCP dispatcher
(`bridge.create` → `callData` → `createData`), and bulk import — while **trusted
internal writers** (better-auth's adapter, the metadata repository, the seed
loader) call `engine.insert` directly and bypass it. Enforcing at the ingress
protects every caller/agent path at once without stripping the internal writers
that legitimately seed read-only columns on create (identity provisioning,
provenance stamps, event-log cursors) — the blast radius an engine-level insert
strip would have.

- **Caller-forged only, at the ingress.** The payload here is raw caller input
  (the security middleware stamps `owner_id` / `organization_id` later, inside
  `engine.insert`), so only keys the caller actually sent are dropped; server
  stamps are added afterwards and are unaffected.
- **Re-derives the default.** A stripped field falls back to its declared
  `defaultValue` in the engine (a forged `approval_status` becomes `draft`, not
  NULL).
- **System-context exempt.** `isSystem` writes still seed read-only columns.
- **Silent** (HTTP 2xx), per-row on batch/import. `readonlyWhen` stays
  INSERT-exempt (a conditional lock needs a prior record).
- **Author-defined business objects only.** Platform objects (`managedBy` set,
  or the `sys_` namespace) carry their own field-write governance that a silent
  strip must not pre-empt — e.g. ADR-0086 REJECTS (403) a forged
  `managed_by:'package'` on `sys_permission_set`, and #3004 rejects a forged
  `owner_id`; several of those columns are `readonly`, so stripping them here
  would swallow the payload the guard is meant to reject. The #3043 threat is app
  approval/status fields, never `sys_` — the same boundary `applySystemFields`
  uses for ownership.

Behavior change: a non-system create through the data API (REST / GraphQL / MCP /
import) can no longer seed a `readonly` column from the payload. Flows that
legitimately write read-only columns at creation must run with a system context
(`isSystem`), the same requirement the UPDATE strip already imposes.
