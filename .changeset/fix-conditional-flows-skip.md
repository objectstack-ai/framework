---
"@objectstack/service-automation": patch
"@objectstack/objectql": patch
---

Fix conditional & record-change flows silently skipping.

Two bugs together caused every flow with a start-node / edge **condition** to
silently skip (record-change triggers fired but the flow body never ran;
audit-style `previous.*` gates and `budget > 100000`-style gates all evaluated
to false):

- **service-automation — CEL engine unreachable in ESM.** The condition
  evaluator loaded the formula engine via a CommonJS `require('@objectstack/formula')`.
  In the package's ESM build (`"type": "module"`) that resolves to tsup's
  throwing `__require` stub, so **every** CEL evaluation threw and the
  swallowing `catch` returned `false`. Replaced with a static top-level import,
  which binds correctly in both the ESM and CJS builds.

- **objectql — prior record not exposed to update hooks.** `HookContext`
  documents a `previous` snapshot for update/delete, but `engine.update` never
  populated it (the row it fetched for validation was a local var). Record-change
  conditions like `status == "done" && previous.status != "done"` therefore had
  no `previous` to read. The engine now attaches the pre-update record to
  `hookContext.previous` for single-id updates whenever a validation rule needs
  it or an `afterUpdate` hook is registered.

Both paths are covered by new unit tests.
