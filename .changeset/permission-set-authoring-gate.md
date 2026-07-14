---
"@objectstack/metadata-protocol": minor
"@objectstack/plugin-security": minor
---

Reject environment-door metadata saves that target a package-owned permission set (ADR-0094 D5, closes framework#2898) — the last inert-metadata hole from the pure-projection refactor.

- **`@objectstack/metadata-protocol`**: new `registerMutationProjector` sibling `registerAuthoringGate(type, fn)` — a per-type gate run inside `saveMetaItem` before persistence; a returned rejection becomes a thrown Error carrying `code`/`status`. The domain plugin that owns a type's projection decides (the generic layer stays shape-agnostic). Fail-open on a gate error (this closes an inert-metadata hole, not a hard boundary).
- **`@objectstack/plugin-security`**: registers a `permission` gate that refuses an env-scope `saveMetaItem` whose target name is a `managed_by:'package'` `sys_permission_set` record — previously such an overlay persisted but neither projected nor enforced (ADR-0049 violation). The package door (a save carrying the owning `packageId`) and env-authored/new sets are unaffected. Error code `package_owned` (403) with "edit the package and re-publish, or clone to a new name" guidance.

Also lands a dogfood proof (`showcase-permission-projection`) binding the ADR-0094 pure-projection invariants — write-through, awaited projection, declared-set edit becomes an enforced overlay, delete-as-reset, and this authoring gate — into the liveness proof registry.
