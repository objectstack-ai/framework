---
"@objectstack/objectql": minor
"@objectstack/metadata": minor
---

Metadata registered through the metadata-service path now carries package provenance. `loadMetadataFromService` and `MetadataFacade.register` pass each item's own `_packageId` through to `registry.registerItem` so `applyProtection` stamps `_packageId`/`_provenance: 'package'` (never a synthetic id — `isArtifactBacked()` write authorization keys off `_packageId`). New `MetadataPluginOptions.packageId` lets hosts running the filesystem scanner declare the owning package id for scanned source-file metadata, closing the same gap for hand-wired kernels. GET /api/v1/meta/:type consumers (e.g. objectui NavigationSyncEffect) can now distinguish package-shipped items from user-authored rows without name heuristics.
