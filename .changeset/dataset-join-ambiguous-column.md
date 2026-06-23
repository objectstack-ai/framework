---
"@objectstack/service-analytics": patch
---

fix(analytics): qualify base-object columns in joined dataset queries

A dataset that joins a related object (`include` + a `relationship.field`
dimension/measure) emitted BARE base-table columns in SELECT/GROUP BY while the
joined columns were alias-qualified. When the base and joined tables share a
column name (e.g. both have `status`), the query failed at runtime with
"ambiguous column name". `NativeSQLStrategy` now qualifies plain base-column
identifiers with the base table when the cube has joins; single-object cubes
are unchanged (byte-for-byte identical SQL).
