---
"@objectstack/spec": patch
---

**The `view` metadata type-schema now validates all three runtime `view` shapes instead of stripping two of them to `{}`.** `metadata-type-schemas.ts` mapped `view` to the aggregate container `ViewSchema` (`{ list, form, listViews, formViews }`, every slot optional). Zod strips unknown keys, so the two non-container shapes a `view` body actually carries at runtime — a standalone **ViewItem record** (`{ name, object, viewKind, config }`) and a **console personalization overlay** (raw view config + identity inherited by `normalizeViewMetadata`, #2555) — both strip-parsed to `{}`. That made the `422` check in `saveMetaItem` and read-time `computeMetadataDiagnostics` a **no-op** for those shapes: a broken `config` (e.g. a kanban missing `groupByField`) saved with a false `200` and badged valid, and the view create-seed test validated against nothing.

`view` now maps to a new `ViewMetadataSchema` — a union over the three shapes, each validated genuinely:

1. **defineView container** — non-empty (`ViewSchema` refined to require at least one of `list`/`form`/`listViews`/`formViews`; an empty container is rejected, mirroring `defineView`).
2. **ViewItem record** — `ViewItemSchema`; the nested `config` is validated against ListView/FormView.
3. **Flattened personalization overlay** — inline ListView/FormView config plus optional identity fields. Structural guards pin `config`/`list`/`form`/`listViews`/`formViews` to `undefined` so a malformed record or container can never be rescued through this lenient branch with its real payload silently stripped.

All members strip-parse (no `.strict()`), so auxiliary Studio round-trip keys (`isPinned`, `sortOrder`, …) still ride along without a false `422`, and `saveMetaItem` keeps persisting the body verbatim. `z.toJSONSchema()` emits the schema as an `anyOf` of the four members, which `/api/v1/meta/types/view` serves to Studio's SchemaForm.

Fixes #3095.
