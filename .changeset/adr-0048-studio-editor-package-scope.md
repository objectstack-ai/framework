---
"@objectstack/objectql": patch
"@objectstack/rest": patch
---

fix(metadata): package-scope the layered (Studio editor) read via `?package=` (ADR-0048)

The `?layers=true` single-item read (the Studio metadata editor's 3-state
code/overlay/effective view) ignored `packageId`, so editing one of two
same-named items from different packages resolved ambiguously (first match).

- `protocol.getMetaItemLayered` now threads `packageId` into the code layer
  (`metadataService.get` + `lookupArtifactItem` + `registry.getItem`) and the
  `sys_metadata` overlay query (`package_id` prefer-local).
- `registry.getArtifactItem(type, name, currentPackageId?)` and
  `lookupArtifactItem` gained the optional package-scope hint.
- `rest-server` threads `?package=` into the layered branch.

This completes the per-route package-scoped resolution audit: the runtime
render surface (dashboard/report/page/doc) was already scoped; this closes the
Studio editor (`/apps/:appName/metadata/:type/:name`). Frontend counterpart
sends `?package=` from the metadata list row's owning package.
