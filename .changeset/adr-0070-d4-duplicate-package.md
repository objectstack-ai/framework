---
"@objectstack/objectql": patch
"@objectstack/runtime": patch
---

feat(objectql): duplicate a writable base — ADR-0070 D4 ("duplicate base")

`protocol.duplicatePackage` clones every ACTIVE item a base owns into a NEW
package, **re-namespacing** object names (the blueprint prefixes a base's object
names with its namespace, e.g. `iojn_repair_ticket`, and `sys_metadata` keys on
`(type,name,org)` so a same-name copy would collide with the source) and
**rewriting every intra-package reference** (lookup `reference`, view `object`,
expressions, …) to the new names via a longest-first, identifier-boundary
replace. Exposed as `POST /packages/:id/duplicate` (body
`{ targetPackageId, targetName?, targetNamespace? }`).

Completes ADR-0070 D4 (package = lifecycle unit): delete-cascade and export
already shipped; this adds the duplicate gesture.
