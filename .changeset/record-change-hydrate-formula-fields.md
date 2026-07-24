---
"@objectstack/trigger-record-change": patch
---

fix(trigger-record-change): hydrate read-time formula fields onto the seeded flow record (#3426)

A `formula` field is a read-time virtual — the engine evaluates it post-fetch on
`find`/`findOne`, never on the write path — so it was absent from the raw
after-create/after-update row a record-change flow is seeded with. A notify
node template like `{record.full_name}` (or a start condition on the same field)
therefore resolved to an empty string, silently emitting notifications such as
`"New lead to assign: "` with the name missing.

The record-change trigger now re-reads the just-written record through the data
engine, so the seeded `record` carries the same computed fields a data-API read
returns. The fix is at the trigger (the producer of the flow's `record`), so it
benefits the whole flow — start condition, every node, and notify `title`/`body`
templates — not just the notify node.

Deliberately conservative:

- Runs only for `afterInsert` / `afterUpdate` (the row exists in its post-write
  state); `before*` and `afterDelete` keep the raw hook record untouched.
- Reads as an elevated system principal, so it can only ADD computed fields,
  never let RLS/FLS on the re-read shrink the snapshot the flow already saw.
- Raw hook fields win on merge, preserving trigger-time scalar values and the
  #1872 multi-lookup input overlay; the re-read only fills in keys the raw row
  lacks (the formula virtuals).
- Any failure (no read surface, no id, a throw, an empty read) falls back to the
  raw record — hydration never breaks the flow it feeds.

Lookup **traversal** (`{record.account.name}`) is intentionally not hydrated: a
default data-API read does not expand relations either, and expanding would turn
`record.account` from its scalar FK id into an object, breaking templates and
conditions that use the bare id (e.g. #1872's `{record.target_channels.0}`).
That traversal remains tracked on #3426.
