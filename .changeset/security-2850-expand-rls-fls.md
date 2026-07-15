---
'@objectstack/objectql': patch
'@objectstack/plugin-security': patch
---

fix(security): enforce referenced-object RLS/FLS on $expand (#2850)

`expandRelatedRecords` resolved lookup/master_detail/user references via the
driver directly, so the referenced object's row- and field-level security never
ran — any API/session caller who could read a base row could `?expand=` a
foreign key and receive RLS-hidden rows and FLS-masked fields (tenant isolation
was the only surviving boundary).

The expand batch now routes through the engine's own `find`, so the security
middleware applies the referenced object's RLS + FLS to the `id $in [...]` batch
(one query per level, no N+1). The sub-read carries a server-set `__expandRead`
marker: the middleware waives only the object-level CRUD / requiredPermissions
gate for PUBLIC referenced objects (already broadly readable — avoids
over-blocking common status/owner lookups), while PRIVATE referenced objects
keep the full gate. Covers the list and single-record REST/protocol surfaces.
