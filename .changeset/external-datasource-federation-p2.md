---
"@objectstack/spec": minor
"@objectstack/service-external-datasource": minor
---

External Datasource Federation (ADR-0015) — Phase 2 (service core).

Adds the federation service contract, the type-compatibility matrix, and a
new service package that introspects, drafts, and validates federated
objects:

- `@objectstack/spec`:
  - `data/type-compat.ts` — dialect-aware SQL↔field-type matrix
    (`canonicalizeSqlType`, `suggestFieldType`, `isCompatible`) for
    postgres/mysql/sqlite/snowflake/bigquery/mongo.
  - `contracts/external-datasource-service.ts` — `IExternalDatasourceService`
    plus `RemoteTable`, `GenerateDraftOpts`, `ObjectDraft`,
    `SchemaValidationResult`/`Report`.
- `@objectstack/service-external-datasource` (new): implements the service —
  `listRemoteTables`, `generateObjectDraft` (renders a reviewable
  `*.object.ts` with `// REVIEW:` markers), `validateObject`/`validateAll`
  (structured `SchemaDiffEntry` diffs), and `refreshCatalog`. Decoupled from
  the kernel via injected I/O; kernel plugin registers it as the
  `external-datasource` service.

REST routes and the `os datasource` CLI commands follow in a subsequent
slice.
