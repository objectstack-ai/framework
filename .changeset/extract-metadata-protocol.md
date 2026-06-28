---
'@objectstack/objectql': minor
'@objectstack/metadata-protocol': minor
---

Extract metadata management into `@objectstack/metadata-protocol` (ADR-0076)

`protocol.ts` (the `ObjectStackProtocol` implementation — sys_metadata CRUD, draft/publish, locks, package ownership, diagnostics) plus its `sys-metadata-repository`, `metadata-diagnostics`, `seed-loader`, and `build-probes` helpers were metadata-domain code that lived inside `@objectstack/objectql` for historical reasons. They now live in a dedicated **`@objectstack/metadata-protocol`** package.

The protocol no longer depends on the concrete `ObjectQL` class — it is typed against an injected `MetadataHostEngine` interface (the engine is still injected at runtime). Dependency direction is now one-way (`objectql → metadata-protocol`); there is no cycle.

**Non-breaking**: `@objectstack/objectql` re-exports every previously public symbol (`ObjectStackProtocolImplementation`, `SysMetadataRepository`, `SysMetadataEngine`, `SeedLoaderService`, `runBuildProbes`, …), so existing imports keep working.

This is Step 1 of ADR-0076. A later step turns the protocol into a capability plugin so `objectql` itself stops depending on it (making the engine lean by construction).

Also adds a lean **`@objectstack/objectql/core`** entry — the engine/registry/hooks/validation surface only, with no kernel plugin or metadata protocol — so a thin embedder can import just the engine and never pull `@objectstack/metadata-protocol` into its bundle. A boundary ratchet test guards the entry.
