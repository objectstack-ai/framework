---
"@objectstack/objectql": patch
---

feat(objectql): hash-compat dry-run probe for the legacy → repository
write-path migration (ADR-0008 PR-10d.1). Pure-function `runDryRun()` plus
a CLI (`scripts/dry-run-hash-compat.ts`) that audits a snapshot of
`sys_metadata` for invalid JSON, non-object bodies, unstable hashes across
canonical round-trip, and duplicate overlay keys. Exits non-zero when
incompatibilities are found. 14 unit tests covering happy paths, error
classifications (`invalid_json`, `non_object_body`, `unstable_hash`,
`missing_metadata`, `duplicate_overlay_key`), and boundary conditions
(empty snapshot, deep nesting, unicode).
