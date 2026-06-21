// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { defineDatasource } from '@objectstack/spec/data';

/**
 * A code-defined EXTERNAL datasource (ADR-0015 federation) — a *second*,
 * read-only SQLite file separate from the managed standalone DB. It exists so
 * the showcase can demonstrate the full federation path with **no external
 * server**: `os dev` provisions the fixture file at boot (see
 * `external-fixture.ts`), then federated objects bound to its tables are
 * queryable through the normal ObjectQL/REST surface.
 *
 * `schemaMode: 'external'` ⇒ ObjectStack never runs DDL here (it's a guest in a
 * database it does not own). `onMismatch: 'warn'` keeps a fixture hiccup from
 * bricking the whole showcase boot — the rest of the demo still loads.
 *
 * It also shows up in **Setup → Integrations → Datasources** and via
 * `GET /api/v1/meta/datasource`, where an admin can run the runtime
 * "Sync objects" wizard against it.
 */
export const ShowcaseExternalDatasource = defineDatasource({
  name: 'showcase_external',
  label: 'External Analytics (SQLite)',
  driver: 'sqlite',
  schemaMode: 'external',
  // Relative path → resolved against the project cwd by better-sqlite3, the
  // same place the fixture writes it. Sits next to the managed standalone.db.
  config: { filename: '.objectstack/data/showcase_external.db' },
  external: {
    label: 'External Analytics DB — read-only federation demo (ADR-0015)',
    allowWrites: false,
    validation: { onMismatch: 'warn', checkOnBoot: true },
  },
  active: true,
});

// ── Optional secret demo (commented) ────────────────────────────────────────
// A Postgres variant exercising a `secret` credential field. Uncomment and
// point at a real warehouse to see the MASKED secret widget in
// Setup → Datasources (objectui#1853). Left commented so the default example
// needs no external server.
//
// export const ShowcaseWarehouseDatasource = defineDatasource({
//   name: 'showcase_warehouse',
//   label: 'Analytics Warehouse (Postgres)',
//   driver: 'postgres',
//   schemaMode: 'external',
//   config: { host: 'localhost', port: 5432, database: 'analytics', user: 'readonly' },
//   external: {
//     allowWrites: false,
//     credentialsRef: 'secret:warehouse/password',
//     validation: { onMismatch: 'fail', checkOnBoot: true },
//   },
//   active: false,
// });
