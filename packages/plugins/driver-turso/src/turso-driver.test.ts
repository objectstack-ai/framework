// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TursoDriver } from '../src/turso-driver.js';
import { SqlDriver } from '@objectstack/driver-sql';

// ── TursoDriver Core ─────────────────────────────────────────────────────────

describe('TursoDriver (SQLite Integration)', () => {
  let driver: TursoDriver;

  beforeEach(async () => {
    driver = new TursoDriver({ url: ':memory:' });

    // Access the inherited Knex instance for test setup
    const k = (driver as any).knex;

    await k.schema.createTable('users', (t: any) => {
      t.string('id').primary();
      t.string('name');
      t.integer('age');
    });

    await k('users').insert([
      { id: '1', name: 'Alice', age: 25 },
      { id: '2', name: 'Bob', age: 17 },
      { id: '3', name: 'Charlie', age: 30 },
      { id: '4', name: 'Dave', age: 17 },
    ]);
  });

  afterEach(async () => {
    await driver.disconnect();
  });

  // ── Instantiation & Metadata ─────────────────────────────────────────────

  it('should be instantiable', () => {
    expect(driver).toBeDefined();
    expect(driver).toBeInstanceOf(TursoDriver);
  });

  it('should extend SqlDriver', () => {
    expect(driver).toBeInstanceOf(SqlDriver);
  });

  it('should have turso-specific name and version', () => {
    expect(driver.name).toBe('com.objectstack.driver.turso');
    expect(driver.version).toBe('1.0.0');
  });

  it('should expose turso-specific capabilities', () => {
    expect(driver.supports.fullTextSearch).toBe(true);
    expect(driver.supports.jsonQuery).toBe(true);
    expect(driver.supports.queryCTE).toBe(true);
    expect(driver.supports.savepoints).toBe(true);
    expect(driver.supports.indexes).toBe(true);
    expect(driver.supports.connectionPooling).toBe(false);
  });

  it('should expose turso config', () => {
    const config = driver.getTursoConfig();
    expect(config.url).toBe(':memory:');
  });

  // ── CRUD (inherited from SqlDriver) ──────────────────────────────────────

  it('should find records with filters', async () => {
    const results = await driver.find('users', {
      fields: ['name', 'age'],
      where: { age: { $gt: 18 } },
      orderBy: [{ field: 'name', order: 'asc' }],
    });

    expect(results.length).toBe(2);
    expect(results.map((r: any) => r.name)).toEqual(['Alice', 'Charlie']);
  });

  it('should apply $or filters', async () => {
    const results = await driver.find('users', {
      where: {
        $or: [{ age: 17 }, { age: { $gt: 29 } }],
      },
    });
    const names = results.map((r: any) => r.name).sort();
    expect(names).toEqual(['Bob', 'Charlie', 'Dave']);
  });

  it('should find one record by id', async () => {
    const [alice] = await driver.find('users', { where: { name: 'Alice' } });
    expect(alice).toBeDefined();

    const fetched = await driver.findOne('users', alice.id as any);
    expect(fetched).toBeDefined();
    expect(fetched!.name).toBe('Alice');
  });

  it('should create a record', async () => {
    await driver.create('users', { name: 'Eve', age: 22 });

    const [eve] = await driver.find('users', { where: { name: 'Eve' } });
    expect(eve).toBeDefined();
    expect(eve.age).toBe(22);
  });

  it('should auto-generate id on create', async () => {
    const created = await driver.create('users', { name: 'Frank', age: 35 });
    expect(created.id).toBeDefined();
    expect(typeof created.id).toBe('string');
    expect((created.id as string).length).toBeGreaterThan(0);
  });

  it('should update a record', async () => {
    const [bob] = await driver.find('users', { where: { name: 'Bob' } });
    await driver.update('users', bob.id as string, { age: 18 });

    const updated = await driver.findOne('users', bob.id as any);
    expect(updated!.age).toBe(18);
  });

  it('should delete a record', async () => {
    const [charlie] = await driver.find('users', { where: { name: 'Charlie' } });
    const result = await driver.delete('users', charlie.id as string);
    expect(result).toBe(true);

    const deleted = await driver.findOne('users', charlie.id as any);
    expect(deleted).toBeNull();
  });

  it('should count records', async () => {
    const count = await driver.count('users', { where: { age: 17 } } as any);
    expect(count).toBe(2);
  });

  it('should count all records', async () => {
    const count = await driver.count('users');
    expect(count).toBe(4);
  });

  // ── Upsert ───────────────────────────────────────────────────────────────

  it('should upsert (insert) a new record', async () => {
    const result = await driver.upsert('users', { id: 'new-1', name: 'Grace', age: 28 });
    expect(result.name).toBe('Grace');

    const count = await driver.count('users');
    expect(count).toBe(5);
  });

  it('should upsert (update) an existing record', async () => {
    await driver.upsert('users', { id: '1', name: 'Alice Updated', age: 26 });

    const updated = await driver.findOne('users', '1' as any);
    expect(updated!.name).toBe('Alice Updated');
    expect(updated!.age).toBe(26);
  });

  // ── Bulk Operations ──────────────────────────────────────────────────────

  it('should bulk create records', async () => {
    const data = [
      { id: 'b1', name: 'Bulk1', age: 10 },
      { id: 'b2', name: 'Bulk2', age: 20 },
    ];
    const result = await driver.bulkCreate('users', data);
    expect(result.length).toBe(2);
  });

  it('should bulk update records', async () => {
    const updates = [
      { id: '1', data: { age: 99 } },
      { id: '2', data: { age: 88 } },
    ];
    const result = await driver.bulkUpdate('users', updates);
    expect(result.length).toBe(2);
    expect(result[0].age).toBe(99);
    expect(result[1].age).toBe(88);
  });

  it('should bulk delete records', async () => {
    await driver.bulkDelete('users', ['1', '2']);
    const count = await driver.count('users');
    expect(count).toBe(2);
  });

  // ── Transactions ─────────────────────────────────────────────────────────

  it('should support transactions with commit', async () => {
    const trx = await driver.beginTransaction();
    await driver.create('users', { name: 'TrxUser', age: 40 }, { transaction: trx });
    await driver.commit(trx);

    const found = await driver.find('users', { where: { name: 'TrxUser' } });
    expect(found.length).toBe(1);
  });

  it('should support transactions with rollback', async () => {
    const trx = await driver.beginTransaction();
    await driver.create('users', { name: 'RollbackUser', age: 41 }, { transaction: trx });
    await driver.rollback(trx);

    const found = await driver.find('users', { where: { name: 'RollbackUser' } });
    expect(found.length).toBe(0);
  });

  // ── Schema Sync (inherited) ──────────────────────────────────────────────

  it('should sync schema and create tables', async () => {
    await driver.syncSchema('products', {
      name: 'products',
      fields: {
        title: { type: 'string' },
        price: { type: 'float' },
        active: { type: 'boolean' },
        metadata: { type: 'json' },
      },
    });

    const created = await driver.create('products', {
      title: 'Widget',
      price: 9.99,
      active: true,
      metadata: { category: 'tools' },
    });

    expect(created.title).toBe('Widget');
    expect(created.price).toBe(9.99);
  });

  // ── Raw Execution ────────────────────────────────────────────────────────

  it('should execute raw SQL', async () => {
    const result = await driver.execute('SELECT COUNT(*) as count FROM users');
    expect(result).toBeDefined();
  });

  // ── Health Check ─────────────────────────────────────────────────────────

  it('should report healthy connection', async () => {
    const healthy = await driver.checkHealth();
    expect(healthy).toBe(true);
  });

  // ── Pagination ───────────────────────────────────────────────────────────

  it('should support limit and offset', async () => {
    const results = await driver.find('users', {
      orderBy: [{ field: 'name', order: 'asc' }],
      limit: 2,
      offset: 1,
    });
    expect(results.length).toBe(2);
    expect(results[0].name).toBe('Bob');
    expect(results[1].name).toBe('Charlie');
  });

  // ── findStream (inherited) ───────────────────────────────────────────────

  it('should stream records via findStream', async () => {
    const records: any[] = [];
    for await (const record of driver.findStream('users', {})) {
      records.push(record);
    }
    expect(records.length).toBe(4);
  });

  // ── updateMany / deleteMany ──────────────────────────────────────────────

  it('should updateMany records matching a query', async () => {
    const count = await driver.updateMany!('users', { where: { age: 17 } }, { age: 18 });
    expect(count).toBe(2);

    const updated = await driver.find('users', { where: { age: 18 } });
    expect(updated.length).toBe(2);
  });

  it('should deleteMany records matching a query', async () => {
    const count = await driver.deleteMany!('users', { where: { age: 17 } });
    expect(count).toBe(2);

    const remaining = await driver.count('users');
    expect(remaining).toBe(2);
  });

  // ── Sorting ──────────────────────────────────────────────────────────────

  it('should sort results', async () => {
    const results = await driver.find('users', {
      orderBy: [{ field: 'age', order: 'desc' }],
    });
    expect(results[0].name).toBe('Charlie');
    expect(results[results.length - 1].age).toBe(17);
  });

  // ── Edge Cases ───────────────────────────────────────────────────────────

  it('should return empty array for no matches', async () => {
    const results = await driver.find('users', { where: { age: 999 } });
    expect(results).toEqual([]);
  });

  it('should return null for findOne with no match', async () => {
    const result = await driver.findOne('users', { where: { name: 'NonExistent' } });
    expect(result).toBeNull();
  });

  it('should return false when deleting non-existent record', async () => {
    const result = await driver.delete('users', 'non-existent-id');
    expect(result).toBe(false);
  });
});

// ── Sync Configuration ───────────────────────────────────────────────────────

describe('TursoDriver Sync Configuration', () => {
  it('should report sync not enabled for memory mode', () => {
    const driver = new TursoDriver({ url: ':memory:' });
    expect(driver.isSyncEnabled()).toBe(false);
  });

  it('should return null libsql client when sync not configured', () => {
    const driver = new TursoDriver({ url: ':memory:' });
    expect(driver.getLibsqlClient()).toBeNull();
  });

  it('should handle sync() gracefully when not configured', async () => {
    const driver = new TursoDriver({ url: ':memory:' });
    // Should not throw
    await driver.sync();
  });
});

// ── URL Parsing & Validation ─────────────────────────────────────────────────

describe('TursoDriver URL Parsing', () => {
  it('should parse file: URL correctly', () => {
    const driver = new TursoDriver({ url: 'file:./data/test.db' });
    expect(driver.getTursoConfig().url).toBe('file:./data/test.db');
  });

  it('should handle :memory: URL', () => {
    const driver = new TursoDriver({ url: ':memory:' });
    expect(driver.getTursoConfig().url).toBe(':memory:');
  });

  it('should throw for remote-only URL without syncUrl', () => {
    expect(() => new TursoDriver({
      url: 'libsql://test-db.turso.io',
      authToken: 'test-token',
    })).toThrow('not supported without "syncUrl"');
  });

  it('should accept remote URL when syncUrl is provided', () => {
    // Should not throw — embedded replica mode
    const driver = new TursoDriver({
      url: 'libsql://test-db.turso.io',
      syncUrl: 'libsql://test-db.turso.io',
      authToken: 'test-token',
    });
    expect(driver.getTursoConfig().syncUrl).toBe('libsql://test-db.turso.io');
  });
});

// ── Capabilities ─────────────────────────────────────────────────────────────

describe('TursoDriver Capabilities', () => {
  it('should declare all required IDataDriver capabilities', () => {
    const driver = new TursoDriver({ url: ':memory:' });
    const caps = driver.supports;

    // CRUD
    expect(caps.create).toBe(true);
    expect(caps.read).toBe(true);
    expect(caps.update).toBe(true);
    expect(caps.delete).toBe(true);

    // Bulk
    expect(caps.bulkCreate).toBe(true);
    expect(caps.bulkUpdate).toBe(true);
    expect(caps.bulkDelete).toBe(true);

    // Transactions
    expect(caps.transactions).toBe(true);
    expect(caps.savepoints).toBe(true);

    // Query
    expect(caps.queryFilters).toBe(true);
    expect(caps.queryAggregations).toBe(true);
    expect(caps.querySorting).toBe(true);
    expect(caps.queryPagination).toBe(true);

    // Turso-specific
    expect(caps.fullTextSearch).toBe(true);
    expect(caps.jsonQuery).toBe(true);
    expect(caps.queryCTE).toBe(true);

    // Schema
    expect(caps.schemaSync).toBe(true);
  });
});
