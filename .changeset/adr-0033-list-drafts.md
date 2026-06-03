---
"@objectstack/objectql": minor
"@objectstack/rest": patch
"@objectstack/runtime": patch
---

feat(metadata): expose pending DRAFT metadata (ADR-0033 draft discoverability)

AI-authored metadata lands as drafts (`sys_metadata` rows with `state='draft'`, bound to an app package), but the only list path — `getMetaItems` — reads the active registry, so drafts were invisible: a just-built app package looked empty and there was no "pending changes" surface.

- `SysMetadataRepository.listDrafts({type?, packageId?})` lists draft rows (mirrors `list()` but scoped to `state='draft'`, optionally narrowed by package), returning a light header projection (no body) with `packageId`.
- `protocol.listDrafts({packageId?, type?, organizationId?})` exposes it over the overlay repo.
- `GET /api/v1/meta/_drafts?packageId=&type=` surfaces it to the console. Registered in the REST server before the greedy `/meta/:type` route (and mirrored in the dispatcher) so `_drafts` is never captured as a metadata type name.

Read-only; no behavior change to existing list/publish paths. Powers the upcoming Studio "drafts/pending changes" view and draft-aware package contents.
