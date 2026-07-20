---
"@objectstack/plugin-security": patch
---

**Derive the better-auth managed-object write denies from the live registry (#3325, follow-through of ADR-0092 / ADR-0103).** The default permission sets deny generic writes on better-auth identity tables via a hand-maintained `BETTER_AUTH_MANAGED_OBJECTS` list — exactly the drift ADR-0092 forbids, and it had already drifted (the list carried 17 names while 22 schemas declare `managedBy: 'better-auth'`, leaving `sys_scim_provider`, `sys_sso_provider`, and three `sys_oauth_*` tables wildcard-granted for writes at the permission-evaluator layer; the identity write guard still 403'd the actual write, so this was a defense-in-depth gap, not a live hole).

- New `applyManagedWriteDenies` (`managed-object-write-denies.ts`) injects a read-only-write deny for every registered `managedBy: 'better-auth'` object into the four write-granting default sets (`organization_admin`, `member_default`, `viewer_readonly`, MCP write) at `kernel:ready`, mutating the shared in-memory `bootstrapPermissionSets` in place (the array the evaluator resolves and the seeder serializes — a DB-row-only fix would be dead code). Never touches `admin_full_access`, never overrides an existing explicit entry, ignores `userActions` (the better-auth bucket is hard-denied — `sys_user`'s `userActions.edit` opens only a field-level whitelist the identity guard enforces).
- The static `BETTER_AUTH_MANAGED_OBJECTS` list is completed to 22 and kept as a compile-time baseline (covers the pre-`kernel:ready` window), now pinned bidirectionally against the `@objectstack/platform-objects` schemas by a test so it cannot silently rot again.
- Engine-owned `system`/`append-only` objects are deliberately NOT given deny entries — a per-object entry overrides the wildcard and would drop `viewAllRecords`; their writes are already rejected by the ADR-0103 engine guard.

No public API change; the helper is internal. Behavior is byte-preserving for the 17 already-listed tables and closes the gap on the 5 that had drifted.
