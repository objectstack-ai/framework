---
"@objectstack/objectql": patch
---

fix(objectql): master_detail cascade delete + autonumber generation

- `delete` now applies referential delete behavior for incoming relations: `master_detail` cascades to children (the parent owns the child lifecycle; only an explicit `restrict` deviates), `lookup` honors its `deleteBehavior` (default `set_null`). Recurses for grandchildren, depth-guarded, single-id deletes. Previously deleting a parent left its children orphaned.
- `insert` now generates values for empty `autonumber` fields before required-validation (`max+1`, seeded per `object.field`, honors `autonumberFormat`). Previously a required autonumber was rejected as "missing" and autonumber fields were never populated.
