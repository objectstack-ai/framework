---
"@objectstack/objectql": minor
"@objectstack/rest": minor
"@objectstack/runtime": minor
"@objectstack/spec": minor
---

feat(metadata): package-scoped single-item resolution via `?package=` (ADR-0048)

A single-item metadata GET (`/meta/:type/:name?package=<id>`) now resolves
package-scoped (prefer-local): when two installed packages ship an item of the
same `type`/`name`, the requester's own package wins. Previously only the *list*
endpoint was package-aware; a single-item fetch was context-free, so a
cross-package collision always resolved to whichever package registered first.

The fix threads `packageId` end-to-end:

- `@objectstack/rest` — the cacheable single-item path called `getMetaItemCached`
  (ETag keyed on type+name only) and dropped `?package=`. A `?package=` read now
  bypasses that cache and takes the disambiguating `getMetaItem(type, name,
  packageId)` path, so two same-named items never share one cache entry.
- `@objectstack/objectql` — `protocol.getMetaItem` forwards `packageId` to the
  overlay query (`sys_metadata.package_id`), `MetadataFacade.get`, and
  `registry.getItem`; `MetadataFacade.get` gained an optional `currentPackageId`.
- `@objectstack/runtime` — the parallel HTTP dispatcher threads `?package=` too.

This lets the doc viewer (`/apps/:packageId/docs/:name`) resolve one doc scoped
to its app, so `doc` names no longer need a namespace prefix for uniqueness (the
prefix becomes a recommended convention, like `page`/`dashboard`/`report`);
`doc.zod` doc-comments updated accordingly.
