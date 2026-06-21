// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { SqlDriver } from '@objectstack/driver-sql';

/**
 * Runtime wiring for the external-datasource federation demo (ADR-0015).
 *
 * This is CODE, so it can't live in the declarative artifact — it runs from the
 * stack's `onEnable` hook, which the AppPlugin invokes at boot (Phase 2), before
 * the external-validation gate fires on `kernel:ready` (Phase 3).
 *
 * It does three things, all zero-config so `os dev` "just works":
 *   1. Idempotently provisions the "remote" SQLite file with `customers` /
 *      `orders` tables + a little seed data (a MANAGED driver — DDL allowed).
 *   2. Registers a read-only `schemaMode: 'external'` driver for that same file
 *      under the datasource name `showcase_external`, so ObjectQL can route
 *      queries to it. (Declared datasources are surfaced in the metadata
 *      registry for Setup → Datasources, but a live driver must be registered
 *      for the federated objects to be queryable in standalone mode.)
 *   3. Registers the federated objects' read metadata (DDL-free) so coercion +
 *      the remote-table mapping exist immediately.
 */

// Same relative path as the datasource config — resolved against the project
// cwd by better-sqlite3. `connect()` creates the parent dir if missing.
const EXTERNAL_DB_FILE = '.objectstack/data/showcase_external.db';

const CUSTOMER_TABLE = {
  name: 'customers',
  fields: {
    id: { type: 'text' },
    name: { type: 'text' },
    email: { type: 'text' },
    region: { type: 'text' },
    lifetime_value: { type: 'number' },
  },
};

const ORDER_TABLE = {
  name: 'orders',
  fields: {
    id: { type: 'text' },
    customer_id: { type: 'text' },
    amount: { type: 'number' },
    status: { type: 'text' },
    placed_on: { type: 'date' },
  },
};

const CUSTOMER_ROWS = [
  { id: 'c1', name: 'Aurora Labs', email: 'ap@aurora.example', region: 'NA', lifetime_value: 480000 },
  { id: 'c2', name: 'Borealis GmbH', email: 'billing@borealis.example', region: 'EU', lifetime_value: 312000 },
  { id: 'c3', name: 'Cyan Pacific', email: 'accounts@cyan.example', region: 'APAC', lifetime_value: 95000 },
];

const ORDER_ROWS = [
  { id: 'o1', customer_id: 'c1', amount: 12000, status: 'paid', placed_on: '2026-01-12' },
  { id: 'o2', customer_id: 'c1', amount: 8400, status: 'paid', placed_on: '2026-02-03' },
  { id: 'o3', customer_id: 'c2', amount: 21500, status: 'pending', placed_on: '2026-02-20' },
  { id: 'o4', customer_id: 'c3', amount: 3300, status: 'paid', placed_on: '2026-03-01' },
];

/** Stack `onEnable` payload (subset we use). */
interface OnEnableContext {
  ql: { syncObjectSchema?: (name: string) => Promise<void> };
  drivers: { register: (driver: unknown) => void };
  logger?: { info?: (msg: string, meta?: unknown) => void; warn?: (msg: string, meta?: unknown) => void };
}

export async function setupShowcaseExternalDatasource(ctx: OnEnableContext): Promise<void> {
  // 1. Provision the remote fixture with a MANAGED driver (DDL allowed). Idempotent.
  const fixture = new SqlDriver({
    client: 'better-sqlite3',
    connection: { filename: EXTERNAL_DB_FILE },
    useNullAsDefault: true,
  }) as unknown as {
    name: string;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    initObjects: (objs: unknown[]) => Promise<void>;
    count: (object: string, query: unknown) => Promise<number>;
    bulkCreate: (object: string, rows: unknown[]) => Promise<unknown>;
  };
  fixture.name = 'showcase_external_fixture';
  await fixture.connect();
  try {
    await fixture.initObjects([CUSTOMER_TABLE, ORDER_TABLE]);
    if ((await fixture.count('customers', {})) === 0) {
      await fixture.bulkCreate('customers', CUSTOMER_ROWS);
      await fixture.bulkCreate('orders', ORDER_ROWS);
    }
  } finally {
    await fixture.disconnect();
  }

  // 2. Register the read-only EXTERNAL driver under the datasource name.
  const ext = new SqlDriver({
    client: 'better-sqlite3',
    connection: { filename: EXTERNAL_DB_FILE },
    useNullAsDefault: true,
    schemaMode: 'external',
  } as never) as unknown as { name: string; connect: () => Promise<void> };
  ext.name = 'showcase_external'; // MUST equal the datasource name (ObjectQL routes by driver name).
  await ext.connect();
  ctx.drivers.register(ext);

  // 3. Register read metadata for the federated objects (DDL-free; ADR-0015).
  //    Needed because the driver is registered after the boot schema-sync.
  await ctx.ql.syncObjectSchema?.('showcase_ext_customer');
  await ctx.ql.syncObjectSchema?.('showcase_ext_order');

  ctx.logger?.info?.('[showcase] external datasource "showcase_external" ready — federation demo (ADR-0015)');
}
