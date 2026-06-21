---
"@objectstack/runtime": patch
---

Fix: the artifact-serve path now honors an app-declared default permission-set
profile (`isProfile: true, isDefault: true`) under `objectstack dev`/`serve`/`start`.

`createStandaloneStack` (the boot path used when serving a compiled
`dist/objectstack.json` with no host `objectstack.config.ts`) surfaced
`objects`/`requires`/`manifest` from the artifact bundle but dropped
`permissions[]` and `roles[]`. As a result the CLI's
`appDefaultProfileName(config.permissions)` saw `undefined` and the SecurityPlugin
fell back to the built-in owner-only `member_default` — so an app whose default
profile carries e.g. `readScope: 'unit_and_below'` (ADR-0056 D7 / ADR-0057 D1)
was silently ignored. The config-load path was unaffected because the app's
`permissions` survived via the original stack object.

`createStandaloneStack` now surfaces `permissions[]` and `roles[]` from the
artifact bundle, mirroring the existing `objects`/`requires`/`manifest` handling,
so the artifact-serve path applies the app default profile exactly like the
config-load path.
