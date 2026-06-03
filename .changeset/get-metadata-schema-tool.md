---
'@objectstack/service-ai': minor
---

feat(ai): add `get_metadata_schema` tool so the agent can read a type's contract before authoring

The metadata-authoring agent never sees the real spec Zod schemas — it works against a simplified blueprint or sends a free-form `definition` and only learns the true shape from post-hoc validation errors. For complex types (view, dashboard, flow, …) that means guessing, e.g. a kanban view's required `kanban: { groupByField, columns }` block.

New `get_metadata_schema` tool returns the JSON Schema (via Zod v4's `toJSONSchema`) derived from the SAME live schema `saveMetaItem` validates against (`getMetadataTypeSchema`). The `metadata_authoring` skill now instructs the agent to call it before authoring a non-trivial type, so it conforms first time instead of trial-and-error. Read-only; resolves plural type names; returns a graceful error for types that can't be serialized (e.g. `object`, which the dedicated `create_object` tools cover anyway).
