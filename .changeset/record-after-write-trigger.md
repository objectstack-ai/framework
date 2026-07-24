---
"@objectstack/trigger-record-change": minor
---

feat(trigger-record-change): `record-after-write` fires one flow on create OR update (#3427)

A `record_change` flow's `start` node bound to exactly one lifecycle event via
`triggerType`, so a rule meant to run on both insert and update ("recompute the
SLA whenever a case is created or its priority changes") forced authors to
duplicate the whole flow — two near-identical definitions that drift.

Adds `record-after-write` and `record-before-write` as the **create-OR-update
union** trigger tokens. One `start` node binds both lifecycle hooks
(`afterInsert` + `afterUpdate`) under the same flow; exactly one fires per
mutation (a write is an insert *xor* an update), so it is not a double run.
`delete` is deliberately excluded — a write persists field data, a delete
removes the row. To branch on which event fired inside the flow, test
`previous` (empty on create, populated on update).

- `triggerTypeToHookEvents(triggerType)` (new, plural) is the canonical mapper:
  it returns the list of hook events a token binds, expanding `write` to both.
  `triggerTypeToHookEvent` (singular) is kept for back-compat and now returns
  `null` for the multi-event `write` tokens rather than silently dropping a
  binding.
- The engine already forwards any `record-*` token through to this trigger, so
  no engine, lint, or spec change is needed — the trigger owns the vocabulary.

Documented under Automation › Flows (Create-or-update flow) and the trigger's
README.
