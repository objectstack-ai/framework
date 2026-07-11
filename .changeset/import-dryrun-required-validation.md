---
'@objectstack/rest': patch
---

fix(rest): validate required fields in import dry-run to match the real insert

The bulk-import dry run (`POST /data/:object/import`, `dryRun:true`) only ran cell
coercion and reported every coercible CREATE row as ok — so a row missing a required
NOT-NULL field with no default was green-lit, then died on the real insert with
`NOT NULL constraint failed`. The ImportWizard shows the dry-run result, so it
promised imports that then failed.

Add a required-field pre-check to the shared import runner (CREATE rows only),
mirroring the engine's insert-time validation (`objectql/record-validator.ts` +
`applyFieldDefaults`): a required field is unsatisfied only when it has no value AND
no default; `system`/`readonly`/`autonumber` and the engine-owned lifecycle columns
are exempt. `ExportFieldMeta` gains `required`/`system`/`readonly`/`hasDefault`
(populated by `buildFieldMetaMap`). Applied to both dry-run and real paths so they
stay identical and a real insert returns a readable `<field> is required` instead of
a raw driver error; skipped when `runAutomations` is set (a beforeInsert hook may
populate the field).
