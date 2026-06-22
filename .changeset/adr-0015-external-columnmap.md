---
"@objectstack/driver-sql": patch
---

feat(driver-sql): honor `external.columnMap` on federated (external) objects (ADR-0015).

When a federated object declares `external.columnMap` ({ remoteColumn -> localField }),
the SQL driver now translates queries to the physical remote columns: WHERE and
ORDER BY map local fields to remote columns (value coercion stays keyed by the local
field), `formatOutput` renames remote-column keys back to local field names on read,
and write payloads are key-remapped. Managed objects and external objects without a
columnMap are unchanged (the resolver falls back to the existing per-site behavior).
