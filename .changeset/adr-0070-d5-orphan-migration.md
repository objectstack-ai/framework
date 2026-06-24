---
"@objectstack/objectql": patch
"@objectstack/runtime": patch
---

feat(objectql): adopt orphaned metadata into a base — ADR-0070 D5 migration

`protocol.reassignOrphanedMetadata` bulk-rebinds every package-less orphan
(`package_id` null / `""` / the `sys_metadata` sentinel left by the pre-
package-first stopgaps) onto a target base, leaving already-owned rows
untouched. Exposed as `POST /packages/:id/adopt-orphans`. This is the migration
affordance behind retiring the "Local / Custom" scope (D5): once an env has no
orphans, that scope can be dropped from the selector. Pairs with the kernel's
`writable_package_required` (D1) so no NEW orphans are created.
