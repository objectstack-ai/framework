---
'@objectstack/metadata-core': minor
---

New package: Repository contracts for the metadata lifecycle (ADR-0008).

Definitions only — no I/O. Exports Zod schemas, the
`MetadataRepository` interface, canonical-form helpers
(`canonicalize`, `hashSpec`), and typed errors (`ConflictError`,
`NotFoundError`, `SchemaValidationError`).

This is M0 PR-1 of the four-layer metadata refactor. Subsequent PRs
add `InMemoryRepository`, `MetadataCache`, `FileSystemRepository`
and migrate the existing `MetadataManager` / HMR plumbing onto the
new contracts.
