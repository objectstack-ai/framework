---
'@objectstack/spec': minor
'@objectstack/plugin-hono-server': patch
---

feat(spec): userActions.edit/delete accept per-record CEL predicates (objectui#2614)

`userActions.edit` / `userActions.delete` now accept, in addition to the
plain boolean, an object form `{ enabled?, visibleWhen?, disabledWhen? }`
(`RowCrudActionOverrideSchema`) so the built-in row Edit/Delete affordances
can be hidden or disabled **per record** via CEL predicates — the same
evaluation contract custom row actions already use. `visibleWhen` false →
button not rendered (fail-closed); `disabledWhen` true → rendered disabled
(fail-soft). Advisory UI gating only; server enforcement stays with
permissions/hooks.

`resolveCrudAffordances()` keeps returning the resolved booleans (`enabled`
falls back to the `managedBy` bucket default) and now surfaces the
predicates as `editPredicates` / `deletePredicates`. Boolean-only inputs
produce byte-identical output — zero behavior change for existing schemas.

`clampManagedObjectWrites` (ADR-0092 D2 hint clamp) treats the object form
by its explicit `enabled` flag only: per-record predicates are not a write
grant, so managed objects stay fail-closed unless `enabled === true`.
