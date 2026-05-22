---
"@objectstack/objectql": patch
---

PR-10d.6 — remove `useRepositoryWritePath` feature flag.

Overlay-allowed metadata types (`view`, `dashboard`, `report`,
`email_template`) now unconditionally route through
`SysMetadataRepository.put` (change-log + HMR `seq`). The legacy
raw-engine branch is retained for non-overlay types (`object`, `flow`,
`agent`, etc.) used during control-plane bootstrap, since the repository
`assertAllowed()` whitelist would reject them.

Removed:
- `ObjectStackProtocolImplementation` constructor option
  `{ useRepositoryWritePath: boolean }`.
- `OBJECTSTACK_USE_REPOSITORY_WRITE_PATH` environment variable.

There is no opt-out: behavior is now equivalent to the PR-10d.5 default.
