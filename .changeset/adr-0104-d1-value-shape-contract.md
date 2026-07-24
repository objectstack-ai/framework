---
"@objectstack/spec": minor
"@objectstack/objectql": minor
"@objectstack/rest": patch
"@objectstack/driver-sql": patch
---

feat(spec): field runtime value-shape contract — ADR-0104 phase 1 (D1)

`@objectstack/spec/data` now owns the runtime VALUE shape of every field type
(`field-value.zod.ts`): semantic type classes (`STRING_VALUE_TYPES`,
`NUMERIC_VALUE_TYPES`, `REFERENCE_VALUE_TYPES`, `FILE_REFERENCE_TYPES`,
`STRUCTURED_JSON_TYPES`, `MULTI_CAPABLE_TYPES`, …), the shared
`isMultiValueField`, and `valueSchemaFor(field, 'stored' | 'expanded')`. The
four consumers that each hand-copied this knowledge (objectql record-validator,
rest import-coerce, driver-sql column classification, qa conformance) now
derive from the spec, and the field-zoo round-trip MATRIX is asserted against
the contract so the two cannot drift.

**Write-path change (objectql, warn-first):** previously-unvalidated types —
single `lookup`/`master_detail`/`user`/`tree`, `file`/`image`/`avatar`/
`video`/`audio`, `location`, `address`, `composite`, `repeater`, `record`,
`vector` — are now checked against the contract. A violation **logs a warning
and passes** in this release (legacy rows must not strand their records);
set `OS_DATA_VALUE_SHAPE_STRICT_ENABLED=1` to enforce as a
`400 VALIDATION_FAILED`. The flip to strict-by-default rides a later minor
(ADR-0104 R1/R2).

**Deprecations (removal rides the next spec major), FROM → TO:**

- `CurrencyValueSchema` (`{value, currency}`) → none. A `currency` field's
  value is a **bare number** everywhere in the runtime (validator, SQL `float`
  column, import coercion, field-zoo oracle); the currency code lives in field
  config. Use `valueSchemaFor({type: 'currency'})`.
- `LocationCoordinatesSchema` (`{latitude, longitude}`) → `LocationValueSchema`
  (`{lat, lng}`) — the shape the platform actually stores.
- `AddressSchema` is **adopted** (unchanged) as the enforced `address` value
  contract via `AddressValueSchema`.

No stored data changes shape; the contract codifies deployed reality
("reality wins", ADR-0104 D1).
