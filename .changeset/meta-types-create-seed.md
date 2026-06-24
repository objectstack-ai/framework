---
'@objectstack/spec': minor
'@objectstack/objectql': minor
---

Expose authoritative create seeds via /meta/types (spec-derived create-shape contract, Phase 2)

The minimal valid create seeds added in `@objectstack/spec/kernel` (`getMetadataCreateSeed`) now reach consumers through the real `/meta/types` registry response: each entry carries an optional `createSeed`. The Studio designer / CLI / API clients derive their create defaults from this single source of truth instead of re-inventing them — closing the drift that produced the dashboard-`layout` and action-`body` create→save 422s.

- `@objectstack/spec`: barrel-export `getMetadataCreateSeed` / `listMetadataCreateSeedTypes` from `/kernel`; add optional `createSeed` to the `GetMetaTypesResponse` entry schema.
- `@objectstack/objectql`: `getMetaTypes()` attaches each type's seed (registry + runtime entries). Canvas-create types whose shape is built interactively (report) are intentionally absent.
