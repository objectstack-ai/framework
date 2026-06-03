---
'@objectstack/objectql': minor
'@objectstack/spec': minor
'@objectstack/service-ai': minor
---

fix: AI-built apps are usable immediately — sync new object tables on publish + emit valid kanban config

Two gaps found by end-to-end testing of an AI-built app:

1. **A freshly-published object couldn't accept records until a server restart.** Publishing a drafted object registered it in the in-memory registry but never created its physical table (table sync only ran at boot), so inserts failed with `object_not_found` ("no such table"). Added `ObjectQL.syncObjectSchema(name)` (a targeted, idempotent single-object schema sync) and call it from the publish paths (`protocol.publishMetaItem` and `saveMetaItem` mode:'publish', via `ensureObjectStorage`). Best-effort + non-fatal. New objects are now CRUD-able the moment they're published.

2. **AI-generated kanban views rendered as plain lists** (and sometimes failed validation). The blueprint `viewBody` emitted `list.type:'kanban'` with no `kanban` config; `KanbanConfigSchema` requires `groupByField` **and** `columns`. Added an optional `groupBy` to the blueprint view schema (lenient + strict) and have `apply_blueprint` set `list.kanban = { groupByField, columns }` — using the view's explicit `groupBy` when given, else inferring the object's first `select` field. AI-built kanban views now validate, publish, and carry a real group-by field.
