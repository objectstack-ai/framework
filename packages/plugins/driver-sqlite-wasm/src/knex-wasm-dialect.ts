// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Custom Knex SQLite dialect backed by sql.js (WASM SQLite).
 *
 * Mimics the surface that {@link Client_BetterSQLite3} presents to Knex so
 * the upstream SQLite3 dialect's query compiler, schema builder, and
 * column compiler all keep working unchanged. Only the transport layer —
 * `_driver` / `acquireRawConnection` / `_query` — is swapped out.
 */

import type { SqlJsStatic } from 'sql.js';

import {
  WasmSqliteConnection,
  type PersistMode,
  type WasmConnectionOptions,
} from './wasm-connection.js';

// Knex doesn't ship per-dialect type declarations, so the upstream class is
// imported via `require` with a permissive type. The runtime contract is
// documented in `knex/lib/dialects/sqlite3/index.js`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Client_SQLite3 = require('knex/lib/dialects/sqlite3');

/** Connection settings recognised by {@link Client_WasmSqlite}. */
export interface WasmSqliteConnectionSettings {
  filename: string;
  persist?: PersistMode;
  sqlJs?: SqlJsStatic;
  locateFile?: (file: string) => string;
  logger?: WasmConnectionOptions['logger'];
}

/**
 * Coerce JS values that sql.js cannot bind directly. Mirrors
 * {@link Client_BetterSQLite3._formatBindings}.
 */
function formatBindings(bindings: unknown[] | undefined): unknown[] {
  if (!bindings) return [];
  return bindings.map((b) => {
    if (b instanceof Date) return b.valueOf();
    if (typeof b === 'boolean') return Number(b);
    return b;
  });
}

/**
 * Mirrors the dispatch in upstream `Client_SQLite3._query`: only
 * `insert/update/counter/del` go through the row-less write path (and even
 * those switch to the read path when a `RETURNING` clause is requested).
 * Everything else — `select`, `first`, `pluck`, `columnInfo`, raw PRAGMA,
 * DDL with no `method` — is read with `all`/row iteration so Knex sees the
 * same response shape it would from better-sqlite3.
 */
function isReadMethod(method?: string, returning?: unknown): boolean {
  if (method === 'insert' || method === 'update') return !!returning ? true : false;
  if (method === 'counter' || method === 'del') return false;
  return true;
}

class Client_WasmSqlite extends Client_SQLite3 {
  // sql.js has no shared "driver module" the way better-sqlite3 does. Knex
  // only uses `this.driver` to construct connections, and we override
  // `acquireRawConnection`, so a sentinel object is enough.
  _driver(): { name: 'sql.js' } {
    return { name: 'sql.js' };
  }

  async acquireRawConnection(): Promise<WasmSqliteConnection> {
    const settings = (this as any)
      .connectionSettings as WasmSqliteConnectionSettings;

    const conn = new WasmSqliteConnection({
      filename: settings.filename,
      persist: settings.persist,
      sqlJs: settings.sqlJs,
      locateFile: settings.locateFile,
      logger: settings.logger,
    });
    await conn.open(settings.sqlJs, settings.locateFile);
    return conn;
  }

  async destroyRawConnection(connection: WasmSqliteConnection): Promise<void> {
    await connection.close();
  }

  async _query(
    connection: WasmSqliteConnection,
    obj: any,
  ): Promise<any> {
    if (!obj.sql) throw new Error('The query is empty');
    if (!connection) throw new Error('No connection provided');

    const db = connection.raw;
    const bindings = formatBindings(obj.bindings);

    // DDL / transactional control statements have no Knex `method`. sql.js's
    // `prepare`+`step` silently no-ops on many of these (e.g. CREATE TABLE),
    // so route them through `run` which is implemented via `exec` and
    // actually mutates the database.
    const isDdl =
      !obj.method &&
      /^\s*(CREATE|ALTER|DROP|PRAGMA|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|REINDEX|VACUUM|ATTACH|DETACH|TRUNCATE)\b/i.test(
        obj.sql,
      );
    if (isDdl) {
      db.run(obj.sql, bindings as any);
      obj.response = [];
      connection.markDirty('run');
      return obj;
    }

    if (isReadMethod(obj.method, obj.returning)) {
      const stmt = db.prepare(obj.sql);
      try {
        if (bindings.length) stmt.bind(bindings as any);
        const rows: Record<string, unknown>[] = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        obj.response = rows;
      } finally {
        stmt.free();
      }
      return obj;
    }

    // Write path: execute via `run` (no row iteration needed) and capture
    // SQLite's per-connection lastID / changes counters.
    db.run(obj.sql, bindings as any);
    const changes = db.getRowsModified();
    let lastID: number | bigint = 0;
    if (obj.method === 'insert') {
      const r = db.exec('SELECT last_insert_rowid() AS id');
      lastID = (r?.[0]?.values?.[0]?.[0] as number) ?? 0;
    }
    obj.response = [];
    obj.context = { lastID, changes };
    connection.markDirty(obj.method);
    return obj;
  }
}

Object.assign(Client_WasmSqlite.prototype, {
  dialect: 'sqlite3',
  driverName: 'wasm-sqlite',
});

export { Client_WasmSqlite };
export default Client_WasmSqlite;
