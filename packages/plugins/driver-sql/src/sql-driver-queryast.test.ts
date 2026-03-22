// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqlDriver } from '../src/index.js';

/**
 * QueryAST format tests — verifies compatibility with @objectstack/spec QueryAST.
 */
describe('SqlDriver (QueryAST Format)', () => {
  let driver: SqlDriver;

  beforeEach(async () => {
    driver = new SqlDriver({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });

    const k = (driver as any).knex;

    await k.schema.createTable('products', (t: any) => {
      t.string('id').primary();
      t.string('name');
      t.float('price');
      t.string('category');
    });

    await k('products').insert([
      { id: '1', name: 'Laptop', price: 1200, category: 'Electronics' },
      { id: '2', name: 'Mouse', price: 25, category: 'Electronics' },
      { id: '3', name: 'Desk', price: 350, category: 'Furniture' },
      { id: '4', name: 'Chair', price: 200, category: 'Furniture' },
      { id: '5', name: 'Monitor', price: 400, category: 'Electronics' },
    ]);
  });

  afterEach(async () => {
    await driver.disconnect();
  });

  describe('Driver Metadata', () => {
    it('should expose driver metadata for ObjectStack compatibility', () => {
      expect(driver.name).toBe('com.objectstack.driver.sql');
      expect(driver.version).toBeDefined();
      expect(driver.supports).toBeDefined();
      expect(driver.supports.transactions).toBe(true);
      expect(driver.supports.joins).toBe(true);
    });
  });

  describe('Lifecycle Methods', () => {
    it('should support connect method', async () => {
      await expect(driver.connect()).resolves.toBeUndefined();
    });

    it('should support checkHealth method', async () => {
      const healthy = await driver.checkHealth();
      expect(healthy).toBe(true);
    });

    it('should support disconnect method', async () => {
      const testDriver = new SqlDriver({
        client: 'better-sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      });

      await expect(testDriver.disconnect()).resolves.toBeUndefined();
      const healthy = await testDriver.checkHealth();
      expect(healthy).toBe(false);
    });
  });

  describe('QueryAST Format Support', () => {
    it('should support QueryAST with "top" instead of "limit"', async () => {
      const results = await driver.find('products', {
        fields: ['name', 'price'],
        top: 2,
        sort: [{ field: 'price', order: 'asc' as const }],
      } as any);

      expect(results.length).toBe(2);
      expect(results[0].name).toBe('Mouse');
      expect(results[1].name).toBe('Chair');
    });

    it('should support QueryAST sort format with object notation', async () => {
      const results = await driver.find('products', {
        fields: ['name'],
        sort: [
          { field: 'category', order: 'asc' as const },
          { field: 'price', order: 'desc' as const },
        ],
      } as any);

      expect(results.length).toBe(5);
      expect(results[0].name).toBe('Laptop');
      expect(results[3].name).toBe('Desk');
    });

    it('should support QueryAST with filters and pagination', async () => {
      const results = await driver.find('products', {
        filters: [['category', '=', 'Electronics']],
        skip: 1,
        top: 1,
        sort: [{ field: 'price', order: 'asc' as const }],
      } as any);

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Monitor');
    });

    it('should support aggregations in QueryAST format', async () => {
      const results = await driver.aggregate('products', {
        aggregations: [
          { function: 'sum' as const, field: 'price', alias: 'total_price' },
          { function: 'count' as const, field: '*', alias: 'count' },
        ],
        groupBy: ['category'],
      });

      expect(results.length).toBe(2);

      const electronics = results.find((r: any) => r.category === 'Electronics');
      const furniture = results.find((r: any) => r.category === 'Furniture');

      expect(electronics).toBeDefined();
      expect(electronics.total_price).toBe(1625);

      expect(furniture).toBeDefined();
      expect(furniture.total_price).toBe(550);
    });

    it('should support count with QueryAST format', async () => {
      const count = await driver.count('products', {
        filters: [['price', '>', 300]],
      } as any);
      expect(count).toBe(3);
    });
  });

  describe('Backward Compatibility', () => {
    it('should still support legacy UnifiedQuery format with "limit"', async () => {
      const results = await driver.find('products', {
        fields: ['name'],
        limit: 2,
        sort: [['price', 'asc']],
      } as any);

      expect(results.length).toBe(2);
      expect(results[0].name).toBe('Mouse');
    });

    it('should still support legacy aggregate format', async () => {
      const results = await driver.aggregate('products', {
        aggregate: [{ func: 'avg', field: 'price', alias: 'avg_price' }],
        groupBy: ['category'],
      });

      expect(results.length).toBe(2);
      const electronics = results.find((r: any) => r.category === 'Electronics');
      expect(electronics.avg_price).toBeCloseTo(541.67, 1);
    });
  });

  describe('Mixed Format Support', () => {
    it('should handle query with both top and skip', async () => {
      const results = await driver.find('products', {
        top: 3,
        skip: 2,
        sort: [{ field: 'name', order: 'asc' as const }],
      } as any);

      expect(results.length).toBe(3);
      expect(results[0].name).toBe('Laptop');
      expect(results[1].name).toBe('Monitor');
      expect(results[2].name).toBe('Mouse');
    });
  });
});
