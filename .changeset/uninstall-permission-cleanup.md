---
"@objectstack/metadata-protocol": minor
"@objectstack/plugin-security": minor
"@objectstack/rest": patch
---

Package uninstall now revokes the package's data-plane permission rows (#2747, ADR-0086 D3 / ADR-0090 D5 "no ghost grants").

**`@objectstack/metadata-protocol`**: `deletePackage` gains an
uninstall-cleanup seam — the exact mirror of the publish materializer:
domain plugins register named cleanups via `registerUninstallCleanup(name,
fn)` and every cleanup runs with the uninstalled package id, its outcome
reported on the new `cleanups` array of the response (a failed revocation is
visible, never silent). `deletePackage` also unregisters the package from
the in-memory SchemaRegistry (best-effort), so the running kernel stops
serving it without waiting for a restart.

**`@objectstack/plugin-security`**: registers the
`security.package-permissions` cleanup — deletes the package's own
`sys_permission_set` rows (`managed_by: 'package'` + matching `package_id`
only; env-authored and foreign-package rows are never touched, ADR-0086 D4),
their `sys_position_permission_set` / `sys_user_permission_set` bindings
(bindings first, so no dangling grants), and the package's
`sys_audience_binding_suggestion` rows (a reinstall re-prompts fresh).
Also fixes the engine-call signature in the suggestion module: `find`/`delete`
read `context` from their second argument — the previous trailing
`{ context }` argument was ignored, so deletes ran principal-less.

**`@objectstack/rest`**: `DELETE /api/v1/packages/:id` (no version pin) now
goes through `protocol.deletePackage` — one uninstall semantic instead of a
bare `sys_packages` row delete — removing the package's metadata, durable
record, registry entry, and running the cleanups; the response carries
`deletedCount` + `cleanups`. A version-scoped delete keeps the narrow
durable-registry semantics.
