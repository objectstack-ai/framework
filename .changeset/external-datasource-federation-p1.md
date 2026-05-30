---
"@objectstack/spec": minor
"@objectstack/driver-sql": minor
---

External Datasource Federation (ADR-0015) — Phase 1.

Adds the spec foundation and the DDL gate for federating mature external
databases without ObjectStack ever mutating their schema:

- `Datasource.schemaMode` (`managed` | `external` | `validate-only`) and
  `Datasource.external` settings, with a cross-field invariant.
- `Object.external` binding (remote table/schema, writability, column map).
- Shared error contract: `ExternalSchemaMismatchError`,
  `ExternalWriteForbiddenError`, `ExternalSchemaModeViolationError`
  (stable `code`s) + structured `SchemaDiffEntry` rendering.
- `driver-sql` DDL gate: schema-mutating DDL (`initObjects`/`syncSchema`/
  `dropTable`) is rejected when `schemaMode !== 'managed'`.

All changes are additive and backward-compatible (`schemaMode` defaults to
`'managed'`).
