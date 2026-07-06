---
'@objectstack/spec': patch
'@objectstack/objectql': patch
'@objectstack/metadata-protocol': patch
'@objectstack/trigger-record-change': patch
'@objectstack/service-automation': patch
---

Package metadata seed can no longer wedge the platform via record-change automation.

A seeded record whose lifecycle flow self-triggered (a `record-after-update` flow
writing back to its own trigger record) looped forever when its boolean re-entry
guard never tripped — booleans persist as integer `1` on SQLite/libsql and CEL
`1 != true` is `true`. During first-boot seed (which awaits automation) this hung
the whole kernel build.

Three layers:
- `ExecutionContext.skipTriggers` (set by the seed-loader, threaded onto
  `HookContext.session` via `buildSession`) makes the record-change trigger skip
  flow dispatch for seed/bulk writes — seed data is end-state reference data, not
  user events. Lifecycle hooks still run.
- `coerceBooleanFields()` converts SQLite 0/1 (and `'0'/'1'/'true'/'false'`) to
  real booleans on the after-hook view of a record (`hookContext.result` /
  `.previous`), so flow conditions see JS booleans. The value returned to the
  caller is unchanged.
- The automation engine breaks a flow re-entering for the same record while an
  execution is still on the stack (`activeRecordFlows`), a backstop for any
  self-trigger loop.
