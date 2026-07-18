---
"@objectstack/spec": minor
"@objectstack/cli": patch
---

fix(spec): declare `ownership` as a first-class ObjectSchema field (#3175)

The object-level record-ownership model — `ownership: 'user' | 'org' | 'none'`,
which drives the registry's `owner_id` auto-provisioning (`applySystemFields`) —
was read by the engine via `(schema as any).ownership` while `ObjectSchema.create()`
**rejected** it as an unknown top-level key (ADR-0032 / #1535). So a tested engine
opt-out (`ownership: 'org' | 'none'` on catalog / junction tables) could not be
set through the sanctioned authoring path, and the same `ownership` word was read
elsewhere as the unrelated package-contribution kind (`own` / `extend`).

- **spec**: `ObjectSchema` now declares `ownership: z.enum(['user','org','none']).optional()`.
  Authoring the record-ownership opt-out validates cleanly; the registry reads it
  off the typed schema (no `as any`). A retired `ownership: 'own'` / `'extend'`
  value fails with guidance pointing at the record-ownership model and noting that
  `own`/`extend` is the contribution kind (`registerObject`), not an object-schema value.
- **cli**: the `object` scaffold no longer emits the now-invalid `ownership: 'own'`
  (owner injection is the default), and `objectstack info` labels the record model
  with the correct `user` default.

No runtime behavior change: `applySystemFields` and its `owner_id` injection logic
are unchanged — this makes the property the engine already honors legally authorable
and consistently typed.
