---
"@objectstack/objectql": minor
"@objectstack/runtime": patch
"@objectstack/service-package": patch
"@objectstack/service-ai": patch
---

feat(packages): consolidate the package subsystem so AI-built app packages surface in Studio

The package subsystem was split across two stores that never met: the in-memory
`SchemaRegistry` (what the dispatcher's `/api/v1/packages` list/detail and
`getMetaItems({type:'package'})` read — i.e. Studio's package selector) and the durable
`sys_packages` table (where the AI's auto app package, and any `package`-service publish,
were written). Nothing reconciled the two, so an AI-created `app.<name>` package never
appeared in Studio.

This unifies them around one write primitive and one read source:

- **`protocol.installPackage`** is now implemented (it was declared-but-missing). It is the
  single canonical write path: it registers the package in the in-memory registry **and**
  best-effort persists it to `sys_packages` via the `package` service. Non-fatal when no
  `package` service is wired (registry write still succeeds).
- **Dispatcher `POST /api/v1/packages`** routes through `protocol.installPackage` (falling
  back to the bare registry write when the protocol is unavailable), so HTTP installs are
  durable too.
- **`@objectstack/service-package`** reconciles `sys_packages` back into the registry on
  boot, without clobbering filesystem-registered packages — so persisted packages survive a
  restart and stay visible in the registry-backed read paths.
- **`@objectstack/service-ai`** `apply_blueprint` now homes an app via
  `protocol.installPackage` (falling back to the legacy `package`-service publish), so the
  app package lands where Studio reads it.

Still the *legacy* `package_id` plane — sealed `sys_package_version` versioning and
cross-environment promotion remain ADR-0027 follow-ups.
