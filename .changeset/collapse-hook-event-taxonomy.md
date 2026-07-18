---
"@objectstack/spec": patch
"@objectstack/objectql": patch
---

Collapse the hook event taxonomy from 18 declared events to the 8 the engine actually dispatches (#3195). The removed 10 (`beforeFindOne`/`afterFindOne`, `beforeCount`/`afterCount`, `beforeAggregate`/`afterAggregate`, `beforeUpdateMany`/`afterUpdateMany`, `beforeDeleteMany`/`afterDeleteMany`) were declared in `HookEvent` but never fired — the enum mirrored the engine method table instead of domain events, so a hook subscribing to them registered fine and then silently no-op'd.

- `findOne` now fires the same `beforeFind`/`afterFind` hooks as `find` — the read event attaches to record materialization, not the engine method, so one subscription covers every read shape (no separate `beforeFindOne`/`afterFindOne`).
- Bulk (`multi: true`) updates/deletes already fire the singular `beforeUpdate`/`beforeDelete`/`afterUpdate`/`afterDelete` events with the row-scoping predicate in `ctx.input.ast`; this is now documented, and there is no `*Many` event.
- Read authorization / row filtering is the RLS/permission-rule layer's job and field masking is field-level metadata — neither is a hook every author must re-attach.
- `engine.registerHook` now warns when a hook subscribes to an event the engine never dispatches, so enum-vs-dispatch drift can't recur silently.

No shipped hook or authored metadata used any of the removed events; authoring one now fails loudly at parse/validate time instead of registering a dead hook. Skills and docs updated to teach the 8 events and the declarative alternatives.
