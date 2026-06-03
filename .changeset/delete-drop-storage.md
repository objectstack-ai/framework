---
'@objectstack/objectql': minor
'@objectstack/rest': patch
---

feat(metadata): optional storage teardown on delete so "publish to preview" leaves no orphan table

Object storage was create-only: `publishMetaItem` creates a table (`ensureObjectStorage`) but nothing ever dropped one — `deleteMetaItem` only tombstones the metadata row, leaving the physical table behind. That made the pragmatic "publish an object just to preview it with real data, then discard if wrong" loop leave residue.

Adds the inverse path, opt-in and guarded:

- `engine.dropObjectSchema(name)` — inverse of `syncObjectSchema`; resolves the table name + driver and calls the driver's existing `dropTable` (DROP TABLE IF EXISTS / drop collection).
- `deleteMetaItem({ …, dropStorage })` — when `true`, drops the object's physical table after the metadata is removed. **DESTRUCTIVE**, so it is gated: `object` type only (others have no table), `active` state only (drafts were never materialised), and never a `sys_`-prefixed platform table. Default `false` keeps delete non-destructive to data. Best-effort: a drop failure is logged, not thrown.
- REST: `DELETE /meta/:type/:name?dropStorage=true` threads the flag.

This makes "publish to preview → discard" cleanly reversible. Combined with the draft-overlay read mode, it backs the team's chosen approach: lean on publish (into a dev sandbox) for data-level confirmation rather than building a full draft-data preview, and make that publish safely undoable.
