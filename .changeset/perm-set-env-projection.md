---
'@objectstack/plugin-security': patch
---

**Project env-scope permission-set edits onto the `sys_permission_set` record (#2857).**

A `sys_permission_set` has two representations: the authoritative **metadata** the
structured editor writes, and the queryable **data record** (snake_case
JSON-string columns) the admin/Setup surface reads. The metadata→record
projection (`toRowFields` / `upsertPackagePermissionSet`) ran only at **boot** and
on **publish** (package door), and the publish path refuses env-authored rows —
so an environment-scope `save('permission', …)` updated the `sys_metadata`
overlay (and the layered read) but left the `sys_permission_set` record **stale**
(split-brain). Enforcement reads the authoritative metadata so access stayed
correct, but the admin surface showed old values.

Adds the **environment door**: `subscribeEnvPermissionProjection` hooks the
protocol's post-persistence `onMetadataMutation` choke point; on an active
(non-draft) `permission` save it re-reads the fresh effective body via the
layered read (the boot-cached metadata registry would return a stale declared
body) and `upsertEnvPermissionSet` projects the six facets onto the record.
Ownership is decided by the **record's** `managed_by` — env-authored rows
(platform/user/absent) are projected; a package-owned record's baseline is left
to boot re-seed / publish, so the two doors never fight. Mirrors the existing
`authored-translation-sync` mutation-listener pattern.
