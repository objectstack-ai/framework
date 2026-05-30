# Plan: External Datasource Federation (ADR-0015) — Implementation

> Implementation plan and progress tracker for
> [ADR-0015 — External Datasource Federation](../adr/0015-external-datasource-federation.md).
> The ADR is the design source of truth; this document scopes the work
> against the **current** codebase and records what has shipped.

## Context

ObjectStack today owns its `default` datasource and freely runs DDL.
ADR-0015 adds the ability to *federate* a mature external database
(Postgres, Snowflake, BigQuery, …) so the AI/REST/View stack can query it
live, **without ObjectStack ever mutating the remote schema**.

The decisive design choice — a federated object stays a normal `Object`,
its remote-ness expressed by the **datasource it points to**
(`schemaMode !== 'managed'`) plus an optional **`object.external`**
sub-record — means almost the entire downstream stack (ObjectQL, REST,
Views, AI tools, RBAC, audit) works unchanged. Behavioural differences are
enforced by three runtime gates.

## Current-state assessment (greenfield)

A repo-wide grep confirmed **zero** prior implementation of `schemaMode`,
`object.external`, `external_catalog`, `IExternalDatasourceService`,
`type-compat`, or the three error classes. The supporting infrastructure
already exists and is reused:

| Already present (reused) | Location |
|:--|:--|
| Driver `introspectSchema()` (dialect-aware) | `packages/plugins/driver-sql/src/sql-driver.ts` |
| Per-object datasource routing | `packages/objectql/src/engine.ts`, `Object.datasource` |
| `kernel:ready` hook pattern for plugins | `packages/runtime/src/*-plugin.ts` |
| Metadata type registry | `packages/spec/src/kernel/metadata-plugin.zod.ts` (`DEFAULT_METADATA_TYPE_REGISTRY`) |
| Error formatting helpers | `packages/spec/src/shared/error-map.zod.ts` |
| oclif CLI command groups (e.g. `data/`) | `packages/cli/src/commands/` |
| Service package template + DI | `packages/services/service-*` |

## The three runtime gates

| Gate | Layer | Where | Enforces |
|:--|:--|:--|:--|
| **1. DDL** | driver | `sql-driver` `initObjects`/`dropTable` (+ future `applyMigrations`) | No DDL when `schemaMode !== 'managed'`. |
| **2. Boot validation** | runtime | new `external-validation-plugin` on `kernel:ready` | Federated object must match remote table (fail/warn/ignore). |
| **3. Write** | data engine | `IDataEngine.insert/update/delete` | Writes need `datasource.external.allowWrites` **and** `object.external.writable`. |

## Phased rollout

| Phase | Scope | Status |
|:-----:|:--|:--|
| **P1** | Spec changes (`schemaMode`, `object.external`, error classes) + DDL gate in `driver-sql` + tests | ✅ **Done** (this branch) |
| **P2** | `IExternalDatasourceService` impl + type-compat matrix + CLI `introspect`/`validate` | 🟡 **Service core done** (matrix + contract + service); REST routes + CLI pending |
| **P3** | Boot-validation plugin in `@objectstack/runtime` + `external_catalog` metadata type + caching | ⬜ Todo |
| **P4** | `SchemaRetriever` annotation + agent prompt + AI safety nets (LIMIT injection, timeout) | ⬜ Todo |
| **P5** | Studio UI in `../objectui` (wizard, schema browser, mapping editor, validation panel) | ⬜ Todo |
| **P6** | Write gate + `allowWrites`/`writable` double opt-in + tests | ⬜ Todo |
| **P7** | Additional drivers (Snowflake / BigQuery / MySQL) | ⬜ Todo |

**MVP = P1–P4**: connect a read-only Postgres replica, register a few
tables, let AI Data Chat query them safely.

## P1 — delivered in this change

Spec is additive and backward-compatible (defaults preserve current
behaviour).

1. **`packages/spec/src/data/datasource.zod.ts`**
   - `SchemaModeSchema` enum (`managed` | `external` | `validate-only`),
     exported `SchemaMode` type.
   - `ExternalDatasourceSettingsSchema` (label, allowedSchemas,
     `allowWrites`, validation policy, `credentialsRef`, `queryTimeoutMs`,
     `requirePermission`).
   - `Datasource.schemaMode` (default `'managed'`) + `Datasource.external`,
     with a `superRefine` enforcing the cross-field invariant (external
     settings ⇔ non-managed mode).

2. **`packages/spec/src/data/object.zod.ts`**
   - `ObjectExternalBindingSchema` (remoteName, remoteSchema, `writable`,
     columnMap, introspectedAt, ignoreColumns) + `Object.external`.
   - The object↔datasource cross-artefact invariant is intentionally
     enforced at metadata-load time (P3), not in Zod.

3. **`packages/spec/src/shared/external-errors.ts`** (new)
   - `ExternalSchemaMismatchError` / `ExternalWriteForbiddenError` /
     `ExternalSchemaModeViolationError`, each with a stable `code`.
   - `SchemaDiffEntry` type + pure `renderDiffMessage()` (P2/P3 consume it).

4. **DDL gate — `packages/plugins/driver-sql/src/sql-driver.ts`**
   - `SqlDriverConfig` gains an optional `schemaMode` (stripped before Knex).
   - `assertSchemaMutable()` choke-point throws
     `ExternalSchemaModeViolationError` when `schemaMode !== 'managed'`;
     called from `initObjects` (covers `syncSchema`) and `dropTable`.

5. **Tests** — Zod refinements (datasource modes, external settings,
   object binding), error classes + diff rendering, and the DDL gate
   (managed allows DDL; external/validate-only block create/alter/drop;
   `schemaMode` not leaked to Knex).

## P2 — delivered in this change (service core)

1. **`packages/spec/src/data/type-compat.ts`** — pure, dialect-aware matrix
   (`canonicalizeSqlType` → `suggestFieldType` / `isCompatible`) covering
   postgres/mysql/sqlite/snowflake/bigquery/mongo. Returns `true` / `'lossy'`
   / `false`. Independently unit-tested.

2. **`packages/spec/src/contracts/external-datasource-service.ts`** —
   `IExternalDatasourceService` + `RemoteTable`, `GenerateDraftOpts`,
   `ObjectDraft`, `SchemaValidationResult`/`Report`. Reuses the existing
   `IntrospectedSchema` from `schema-diff-service.ts` and `SchemaDiffEntry`
   from `external-errors.ts`.

3. **`packages/services/service-external-datasource`** (new package) —
   `ExternalDatasourceService` implements the contract:
   - `listRemoteTables` (schema-qualified, `allowedSchemas`-filtered),
   - `generateObjectDraft` (type-compat mapping → reviewable `*.object.ts`
     source with `// REVIEW:` markers on lossy/unknown columns),
   - `validateObject` / `validateAll` (structured diffs: `missing_table`,
     `missing_column`, `type_mismatch`; lossy = warning, hard mismatch =
     error; honours `columnMap` + `ignoreColumns`),
   - `refreshCatalog` (snapshot shape; persistence lands with P3's
     `external_catalog` type).
   The service takes injected I/O (`introspect` / `getDatasource` /
   `getObject` / `listObjects`) so it is decoupled and fully unit-tested; the
   `ExternalDatasourceServicePlugin` wires the live `IDataEngine` +
   `IMetadataService` and registers it as the `external-datasource` service.

### Remaining P2 slice (next)

- **REST routes** under `/api/v1/datasources/:name/external/*` (ADR §6.2).
- **CLI** `os datasource list-tables | introspect | validate` (ADR §6.3) —
  thin oclif commands over the REST routes.
- Driver introspection plumbing: expose
  `getDatasourceDriver(name)` / `introspectDatasource(name)` on the data
  engine so the plugin's default `introspect` works end-to-end.

### Follow-up notes / open items for later phases

- **DDL gate plumbing (P3)**: the runtime must inject `Datasource.schemaMode`
  into `SqlDriverConfig` when constructing drivers. P1 wires the driver
  side and defaults to `'managed'`; the runtime wiring lands with the
  boot-validation plugin.
- **`applyMigrations` gate**: `ISchemaDiffService.applyMigrations` also
  needs the gate (per ADR §5.1) when the migration runner ships.
- **Lint rule** preventing plugins from bypassing the gate via raw `knex`
  (ADR §12 risk row) — defer to P2/P3 alongside the service.
- **error-map envelope**: map the three `code`s into the shared error
  envelope when P6 surfaces them over REST.
