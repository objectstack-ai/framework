---
'@objectstack/spec': patch
---

feat(spec): add a typed `stageField` key to the object `detail` block

The detail-page synth (`@object-ui/plugin-detail`) already reads
`def.detail?.stageField` to drive — or disable — the auto status-path stepper
(`record:path`). It only survived via the `detail` block's `.passthrough()`, so
authors got no type or autocomplete and no way to discover the switch. Declare
it explicitly: `string` forces a status field, `false`/`null` disables the
stepper (use it when `status` is a non-linear picklist). `.passthrough()` is
kept for back-compat.
