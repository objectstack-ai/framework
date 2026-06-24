---
'@objectstack/metadata-core': minor
'@objectstack/objectql': minor
'@objectstack/runtime': minor
---

Package-scoped commit history & rollback for AI authoring (ADR-0067)

Each authoring apply now lands as one revertible **commit** on a package timeline, on top of `sys_metadata_history`:

- New `sys_metadata_commit` object groups a turn's metadata changes (by `event_seq` range).
- `publishPackageDrafts` records each publish as one commit (best-effort) with a per-artifact revert plan and an optional `message` / `aiModel`.
- New protocol methods `listCommits`, `revertCommit`, `rollbackToPackageCommit` (reusing `restoreVersion` + delete; a revert is itself an append-only commit).
- New REST routes: `GET /packages/:id/commits`, `POST /packages/:id/commits/:commitId/revert`, `POST /packages/:id/rollback`.
