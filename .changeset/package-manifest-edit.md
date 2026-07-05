---
"@objectstack/objectql": minor
"@objectstack/metadata-protocol": minor
"@objectstack/runtime": minor
---

feat(packages): edit a package manifest via `PATCH /packages/:id`

Adds an editable path for a package's `name` / `description` / `version` after
creation: `SchemaRegistry.updatePackageManifest` (merges in-memory, preserving
lifecycle state), `protocol.updatePackage` (re-persists to `sys_packages`), and
the `PATCH /packages/:id` route in the HTTP dispatcher. `id` / `scope` / `type`
remain immutable.
