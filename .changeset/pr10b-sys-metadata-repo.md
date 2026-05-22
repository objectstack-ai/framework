---
'@objectstack/objectql': minor
---

ADR-0008 M0 PR-10b: introduce `SysMetadataRepository` — a
`MetadataRepository` wrapper over the existing `sys_metadata` table.
M0 keeps single-row update semantics (append-only event log is M1
work). Whitelist enforcement, optimistic locking via content hash,
and in-process watch fan-out are all live. Not yet wired into any
production write path — PR-10c will compose it under a
LayeredRepository.
