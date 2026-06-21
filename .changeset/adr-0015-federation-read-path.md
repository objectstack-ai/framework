---
"@objectstack/driver-sql": patch
"@objectstack/objectql": patch
"@objectstack/spec": patch
---

fix(ADR-0015): honor `external.remoteName` / `external.remoteSchema` on the federation read path.

The query path previously resolved an external object's physical table from the
object name, ignoring its `external` binding — so a federated object bound to a
differently-named remote table failed with `no such table`, and ADR-0015's own
`wh_order` → `mart.fact_orders` example was unqueryable. The SQL driver now
resolves the remote table (`remoteName`, plus `remoteSchema` via `.withSchema()`
on pg/mysql) and registers external objects' read-coercion metadata without DDL
(`SqlDriver.registerExternalObject`, routed from the engine/plugin schema-sync).
The managed path is unchanged. See ADR-0015 §18.
