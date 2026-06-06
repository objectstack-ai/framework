---
'@objectstack/spec': minor
'@objectstack/objectql': minor
---

feat(objectql): compute roll-up `summary` fields server-side

The `summary` field type was declared in the spec but never computed — its value
stayed empty. ObjectQL now recomputes roll-up summaries automatically: a parent
field whose `summaryOperations` aggregates (`count`/`sum`/`min`/`max`/`avg`) a
field across child records is recalculated whenever a child is inserted,
updated, or deleted.

- **`@objectstack/spec`** — `summaryOperations` gains an optional
  `relationshipField` (the child→parent FK). When omitted the engine
  auto-detects it from the child's `lookup`/`master_detail` field whose
  `reference` points back at the parent; set it explicitly only when the child
  has more than one such reference.

- **`@objectstack/objectql`** — after `afterInsert` / `afterUpdate` /
  `afterDelete` on a child object, the engine finds the affected parent (from
  the child's FK, plus the prior FK on update/delete so a re-parented child
  updates both), re-aggregates the child collection, and writes the result onto
  the parent's summary field. It runs in the caller's execution context, so when
  a transaction is open (e.g. the cross-object `/api/v1/batch`) the rollup
  commits atomically with the child writes. A small index of child→summary
  descriptors is built lazily from the registry and invalidated on package
  registration.

Empty collections roll up to `0` for `count`/`sum` and `null` for
`min`/`max`/`avg`. This lets master-detail forms stop computing parent totals on
the client — the server is now the single source of truth.
