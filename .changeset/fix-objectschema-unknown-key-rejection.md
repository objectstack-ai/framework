---
"@objectstack/spec": minor
"@objectstack/platform-objects": patch
---

fix(spec): reject unknown top-level keys on `ObjectSchema.create()` (#1535)

`ObjectSchemaBase` is a plain `z.object({...})` (Zod default `.strip()`), so any
unknown top-level key passed to `ObjectSchema.create()` — `workflows`, a typo'd
`validation`/`indexs`, etc. — was discarded silently: no error, no warning, and a
green `tsc`. Declarative metadata an author believed they shipped (e.g. object-level
`workflows: [...]`) vanished from every built artifact, dead from day one. This is the
metadata-shape analogue of ADR-0032's "no silent failure" principle.

`create()` now rejects unknown top-level keys with a precise, fixable build error that
names the offending key(s), suggests the intended key on a likely typo
(`validation` → `validations`), and — for known-confusable keys like `workflows` —
points authors at the supported mechanism (a lifecycle hook `src/objects/<name>.hook.ts`
or a top-level `record_change` flow; there is no object-level `workflows[]` field). The
factory signature also constrains excess keys to `never`, so the mistake is caught at
`tsc` time as well as at build.

The non-strict `ObjectSchema.parse()` load path (registry/artifact validation) is
unchanged.

Also fixes two platform objects (`sys_secret`, `sys_setting_audit`) that carried
silently-stripped `views`/`scope`/`defaultViewName` keys: their intended list views are
migrated to the supported `listViews` field (`type: 'list'` → `'grid'`) so they now
render instead of being dropped. The `objectstack-data` skill's CRM blueprint no longer
teaches the non-existent `workflows[]` shape.
