---
'@objectstack/objectql': minor
---

fix(security): enforce static `readonly` fields on the UPDATE write path (#2948)

A field's static `readonly: true` was never enforced server-side on update: the
record validator only *skipped* read-only columns from validation, and only the
conditional `readonlyWhen` variant was stripped from the write payload. A
non-system (user-context) update could therefore overwrite any `readonly`
column — audit stamps, provenance (`managed_by`), or other system-computed
values — unless a field-level permission happened to guard it. (The
cross-tenant `organization_id` face was already closed by #2946; this is the
broader in-tenant integrity face.)

`engine.update` now strips **caller-supplied** writes to statically-`readonly`
fields for non-system contexts, on both the single-id and multi-row paths
(symmetric with `readonlyWhen` — it strips, does not reject). Two guards keep
every legitimate write intact:

- **caller-supplied only** — the strip runs against a snapshot of the keys the
  caller sent *before* hooks/middleware ran, so server stamps applied by the
  audit hook (`updated_by`/`updated_at`) and write middleware survive; only a
  client that explicitly forged a read-only field has it dropped.
- **system-context exempt** — `isSystem` writes (import, seed replay, approvals,
  lifecycle hooks) legitimately set read-only columns and skip the strip.

No change for single-org or any write that does not forge a read-only column.
