// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { InMemoryDriver } from '@objectstack/driver-memory';
import {
  inferDriverTypeFromUrl,
  resolveDriverType,
  createStorageDriver,
} from './storage-driver.js';

describe('inferDriverTypeFromUrl', () => {
  it('maps each recognized URL scheme to its canonical driver kind', () => {
    expect(inferDriverTypeFromUrl('mongodb://localhost:27017/db')).toBe('mongodb');
    expect(inferDriverTypeFromUrl('mongodb+srv://cluster/db')).toBe('mongodb');
    expect(inferDriverTypeFromUrl('postgres://u:p@h/db')).toBe('postgres');
    expect(inferDriverTypeFromUrl('postgresql://u:p@h/db')).toBe('postgres');
    expect(inferDriverTypeFromUrl('mysql://u:p@h/db')).toBe('mysql');
    expect(inferDriverTypeFromUrl('mysql2://u:p@h/db')).toBe('mysql');
    expect(inferDriverTypeFromUrl('libsql://x.turso.io')).toBe('turso');
    expect(inferDriverTypeFromUrl('https://x.turso.io')).toBe('turso');
    expect(inferDriverTypeFromUrl('wasm-sqlite://data.db')).toBe('sqlite-wasm');
    expect(inferDriverTypeFromUrl('./local.wasm.db')).toBe('sqlite-wasm');
    expect(inferDriverTypeFromUrl('file:./app.db')).toBe('sqlite');
    expect(inferDriverTypeFromUrl('sqlite:./app.db')).toBe('sqlite');
    expect(inferDriverTypeFromUrl('./app.sqlite')).toBe('sqlite');
  });

  // #3276: the mingo in-memory engine has its own `memory://` URL scheme.
  it('maps the memory:// (and mingo://) scheme to the mingo `memory` kind', () => {
    expect(inferDriverTypeFromUrl('memory://')).toBe('memory');
    expect(inferDriverTypeFromUrl('memory://ignored-host')).toBe('memory');
    expect(inferDriverTypeFromUrl('mingo://')).toBe('memory');
  });

  // The sqlite `:memory:` PSEUDO-FILE is SQLite's own in-memory mode — NOT the
  // mingo engine. It must stay `sqlite`, distinct from the `memory://` scheme.
  it('keeps sqlite `:memory:` mapped to sqlite (distinct from memory://)', () => {
    expect(inferDriverTypeFromUrl(':memory:')).toBe('sqlite');
  });

  it('returns "" for an absent or unrecognized URL', () => {
    expect(inferDriverTypeFromUrl(undefined)).toBe('');
    expect(inferDriverTypeFromUrl('')).toBe('');
    expect(inferDriverTypeFromUrl('redis://localhost')).toBe('');
  });
});

describe('resolveDriverType', () => {
  it('lets an explicit driver win over URL inference (and normalizes case/space)', () => {
    expect(resolveDriverType('memory', 'postgres://h/db')).toBe('memory');
    expect(resolveDriverType('  MEMORY  ', undefined)).toBe('memory');
    expect(resolveDriverType('Postgres', 'mongodb://h/db')).toBe('postgres');
  });

  it('falls back to URL inference when no explicit driver is set', () => {
    expect(resolveDriverType(undefined, 'mongodb://h/db')).toBe('mongodb');
    expect(resolveDriverType('', 'memory://')).toBe('memory');
    expect(resolveDriverType('   ', undefined)).toBe('');
  });
});

describe('createStorageDriver', () => {
  // ── #3276: the regression this whole change exists to fix ──────────────────
  // `memory` must construct the mingo InMemoryDriver — NOT fall through to the
  // dev SQLite `:memory:` default (SQLite-in-memory, a different engine). Remove
  // the `memory` branch in storage-driver.ts and this assertion goes red: in dev
  // it resolves to a SqlDriver/SQLite engine, in prod it resolves to null.
  it('constructs the mingo InMemoryDriver for `memory` in DEV', async () => {
    const r = await createStorageDriver('memory', { isDev: true });
    expect(r).not.toBeNull();
    expect(r!.driver).toBeInstanceOf(InMemoryDriver);
    expect(r!.engine).toBe('memory');
    expect(r!.label).toBe('InMemoryDriver');
    expect(r!.trackName).toBe('MemoryDriver');
    expect(r!.displayUrl).toBe('(in-memory)');
    // Never provisions a telemetry sibling.
    expect(r!.sqliteFilePath).toBeUndefined();
  });

  // The explicit choice is honored in PRODUCTION too — declared === enforced.
  it('constructs the mingo InMemoryDriver for `memory` in PROD', async () => {
    const r = await createStorageDriver('memory', { isDev: false });
    expect(r!.driver).toBeInstanceOf(InMemoryDriver);
    expect(r!.engine).toBe('memory');
  });

  it('accepts the `mingo` and `in-memory` aliases', async () => {
    expect((await createStorageDriver('mingo', { isDev: false }))!.driver).toBeInstanceOf(InMemoryDriver);
    expect((await createStorageDriver('in-memory', { isDev: false }))!.driver).toBeInstanceOf(InMemoryDriver);
  });

  // ── Regression guards for the other branches (no connection is opened) ─────
  it('constructs mongodb with the default URL when none is supplied', async () => {
    const r = await createStorageDriver('mongodb', { isDev: false });
    expect(r!.label).toBe('MongoDBDriver');
    expect(r!.trackName).toBe('MongoDBDriver');
    expect(r!.displayUrl).toBe('mongodb://localhost:27017/objectstack');
  });

  it('constructs postgres / mysql with their SqlDriver labels', async () => {
    const pg = await createStorageDriver('postgres', { databaseUrl: 'postgres://u:p@h/db', isDev: false });
    expect(pg!.label).toBe('SqlDriver(pg)');
    expect(pg!.trackName).toBe('PostgresDriver');
    const my = await createStorageDriver('mysql', { databaseUrl: 'mysql://u:p@h/db', isDev: false });
    expect(my!.label).toBe('SqlDriver(mysql2)');
    expect(my!.trackName).toBe('MySQLDriver');
  });

  it('constructs sqlite-wasm without connecting', async () => {
    const r = await createStorageDriver('sqlite-wasm', { databaseUrl: 'file:./x.db', isDev: false });
    expect(r!.label).toBe('SqliteWasmDriver');
    expect(r!.trackName).toBe('SqliteWasmDriver');
  });

  // In PROD, `resolveSqliteDriver` returns the native driver UNPROBED (no
  // connect), so this is fast and native-addon-free. It also documents that an
  // explicit sqlite primary DOES surface `sqliteFilePath` for the telemetry
  // sibling — the field the `memory` driver deliberately leaves unset.
  it('constructs explicit sqlite and surfaces sqliteFilePath for telemetry', async () => {
    const r = await createStorageDriver('sqlite', { databaseUrl: ':memory:', isDev: false });
    expect(r!.engine).toBe('better-sqlite3');
    expect(r!.label).toBe('SqlDriver(sqlite)');
    expect(r!.trackName).toBe('SqlDriver');
    expect(r!.sqliteFilePath).toBe(':memory:');
  });

  // Production with no driver configured registers nothing (loud downstream
  // failure), rather than silently inventing an engine.
  it('returns null for an unknown/absent driver in PROD', async () => {
    expect(await createStorageDriver('', { isDev: false })).toBeNull();
    expect(await createStorageDriver('nonsense', { isDev: false })).toBeNull();
  });
});
