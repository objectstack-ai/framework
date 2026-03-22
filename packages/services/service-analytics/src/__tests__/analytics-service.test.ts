// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cube } from '@objectstack/spec/data';
import type { AnalyticsQuery, AnalyticsResult, IAnalyticsService } from '@objectstack/spec/contracts';
import { AnalyticsService } from '../analytics-service.js';
import { CubeRegistry } from '../cube-registry.js';
import { NativeSQLStrategy } from '../strategies/native-sql-strategy.js';
import { ObjectQLStrategy } from '../strategies/objectql-strategy.js';
import { InMemoryStrategy } from '../strategies/in-memory-strategy.js';
import type { DriverCapabilities } from '../strategies/types.js';

// ─────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────

const ordersCube: Cube = {
  name: 'orders',
  title: 'Orders',
  sql: 'orders',
  measures: {
    count: { name: 'count', label: 'Count', type: 'count', sql: '*' },
    total_amount: { name: 'total_amount', label: 'Total Amount', type: 'sum', sql: 'amount' },
    avg_amount: { name: 'avg_amount', label: 'Avg Amount', type: 'avg', sql: 'amount' },
  },
  dimensions: {
    status: { name: 'status', label: 'Status', type: 'string', sql: 'status' },
    created_at: {
      name: 'created_at',
      label: 'Created At',
      type: 'time',
      sql: 'created_at',
      granularities: ['day', 'week', 'month'],
    },
  },
  public: false,
};

const baseQuery: AnalyticsQuery = {
  cube: 'orders',
  measures: ['orders.count', 'orders.total_amount'],
  dimensions: ['orders.status'],
};

// Suppress logger output in tests
const silentLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as any;

// ─────────────────────────────────────────────────────────────────
// CubeRegistry
// ─────────────────────────────────────────────────────────────────

describe('CubeRegistry', () => {
  let registry: CubeRegistry;

  beforeEach(() => {
    registry = new CubeRegistry();
  });

  it('should register and retrieve a cube', () => {
    registry.register(ordersCube);
    expect(registry.get('orders')).toEqual(ordersCube);
    expect(registry.has('orders')).toBe(true);
    expect(registry.size).toBe(1);
  });

  it('should register multiple cubes at once', () => {
    const cube2: Cube = { ...ordersCube, name: 'products', sql: 'products' };
    registry.registerAll([ordersCube, cube2]);
    expect(registry.size).toBe(2);
    expect(registry.names()).toEqual(['orders', 'products']);
  });

  it('should return undefined for unknown cube', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('should clear all cubes', () => {
    registry.register(ordersCube);
    registry.clear();
    expect(registry.size).toBe(0);
  });

  it('should infer a cube from object fields', () => {
    const cube = registry.inferFromObject('tasks', [
      { name: 'title', type: 'text', label: 'Title' },
      { name: 'hours', type: 'number', label: 'Hours' },
      { name: 'due_date', type: 'date', label: 'Due Date' },
      { name: 'active', type: 'boolean', label: 'Active' },
    ]);

    expect(cube.name).toBe('tasks');
    expect(cube.measures.count).toBeDefined();
    expect(cube.measures.hours_sum).toBeDefined();
    expect(cube.measures.hours_avg).toBeDefined();
    expect(cube.dimensions.title.type).toBe('string');
    expect(cube.dimensions.hours.type).toBe('number');
    expect(cube.dimensions.due_date.type).toBe('time');
    expect(cube.dimensions.active.type).toBe('boolean');

    // Should also be registered automatically
    expect(registry.get('tasks')).toBe(cube);
  });
});

// ─────────────────────────────────────────────────────────────────
// NativeSQLStrategy
// ─────────────────────────────────────────────────────────────────

describe('NativeSQLStrategy', () => {
  const strategy = new NativeSQLStrategy();

  it('should have correct name and priority', () => {
    expect(strategy.name).toBe('NativeSQLStrategy');
    expect(strategy.priority).toBe(10);
  });

  it('should handle when nativeSql capability is true', () => {
    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
      executeRawSql: vi.fn(),
    };
    expect(strategy.canHandle(baseQuery, ctx)).toBe(true);
  });

  it('should not handle when nativeSql is false', () => {
    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: true, inMemory: false }),
    };
    expect(strategy.canHandle(baseQuery, ctx)).toBe(false);
  });

  it('should not handle when cube is missing', () => {
    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
      executeRawSql: vi.fn(),
    };
    expect(strategy.canHandle({ measures: ['count'] }, ctx)).toBe(false);
  });

  it('should generate SQL with dimensions, measures, and filters', async () => {
    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
      executeRawSql: vi.fn(),
    };

    const query: AnalyticsQuery = {
      cube: 'orders',
      measures: ['orders.count', 'orders.total_amount'],
      dimensions: ['orders.status'],
      filters: [{ member: 'orders.status', operator: 'equals', values: ['completed'] }],
      limit: 10,
    };

    const { sql, params } = await strategy.generateSql(query, ctx);

    expect(sql).toContain('SELECT');
    expect(sql).toContain('COUNT(*)');
    expect(sql).toContain('SUM(amount)');
    expect(sql).toContain('GROUP BY');
    expect(sql).toContain('LIMIT 10');
    expect(params).toContain('completed');
  });

  it('should execute query and return structured result', async () => {
    const mockRows = [
      { 'orders.status': 'completed', 'orders.count': 5, 'orders.total_amount': 500 },
    ];
    const executeRawSql = vi.fn().mockResolvedValue(mockRows);

    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
      executeRawSql,
    };

    const result = await strategy.execute(baseQuery, ctx);

    expect(executeRawSql).toHaveBeenCalled();
    expect(result.rows).toEqual(mockRows);
    expect(result.fields).toHaveLength(3); // 1 dimension + 2 measures
    expect(result.sql).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────
// ObjectQLStrategy
// ─────────────────────────────────────────────────────────────────

describe('ObjectQLStrategy', () => {
  const strategy = new ObjectQLStrategy();

  it('should have correct name and priority', () => {
    expect(strategy.name).toBe('ObjectQLStrategy');
    expect(strategy.priority).toBe(20);
  });

  it('should handle when objectqlAggregate capability is true', () => {
    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: true, inMemory: false }),
      executeAggregate: vi.fn(),
    };
    expect(strategy.canHandle(baseQuery, ctx)).toBe(true);
  });

  it('should not handle without executeAggregate', () => {
    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: true, inMemory: false }),
    };
    expect(strategy.canHandle(baseQuery, ctx)).toBe(false);
  });

  it('should execute an aggregate query', async () => {
    const mockRows = [
      { status: 'pending', 'orders.count': 3, 'orders.total_amount': 150 },
    ];
    const executeAggregate = vi.fn().mockResolvedValue(mockRows);

    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: true, inMemory: false }),
      executeAggregate,
    };

    const result = await strategy.execute(baseQuery, ctx);

    expect(executeAggregate).toHaveBeenCalledWith('orders', expect.objectContaining({
      groupBy: ['status'],
      aggregations: expect.arrayContaining([
        expect.objectContaining({ method: 'count' }),
        expect.objectContaining({ method: 'sum' }),
      ]),
    }));
    expect(result.rows).toHaveLength(1);
    expect(result.fields).toHaveLength(3);
  });

  it('should generate representative SQL', async () => {
    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: true, inMemory: false }),
      executeAggregate: vi.fn(),
    };

    const { sql } = await strategy.generateSql(baseQuery, ctx);
    expect(sql).toContain('SELECT');
    expect(sql).toContain('COUNT(*)');
    expect(sql).toContain('GROUP BY');
  });
});

// ─────────────────────────────────────────────────────────────────
// InMemoryStrategy
// ─────────────────────────────────────────────────────────────────

describe('InMemoryStrategy', () => {
  const strategy = new InMemoryStrategy();

  it('should have correct name and priority', () => {
    expect(strategy.name).toBe('InMemoryStrategy');
    expect(strategy.priority).toBe(30);
  });

  it('should handle when fallbackService is available', () => {
    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: false, inMemory: false }),
      fallbackService: {
        query: vi.fn(),
        getMeta: vi.fn(),
      },
    };
    expect(strategy.canHandle(baseQuery, ctx)).toBe(true);
  });

  it('should handle when inMemory capability is true', () => {
    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: false, inMemory: true }),
    };
    expect(strategy.canHandle(baseQuery, ctx)).toBe(true);
  });

  it('should not handle without fallback and not inMemory', () => {
    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: false, inMemory: false }),
    };
    expect(strategy.canHandle(baseQuery, ctx)).toBe(false);
  });

  it('should delegate to fallback service', async () => {
    const mockResult: AnalyticsResult = { rows: [{ count: 10 }], fields: [{ name: 'count', type: 'number' }] };
    const fallbackService = {
      query: vi.fn().mockResolvedValue(mockResult),
      getMeta: vi.fn(),
    };

    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: false, inMemory: true }),
      fallbackService,
    };

    const result = await strategy.execute(baseQuery, ctx);
    expect(fallbackService.query).toHaveBeenCalledWith(baseQuery);
    expect(result).toEqual(mockResult);
  });

  it('should throw when no fallback service', async () => {
    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: false, inMemory: true }),
    };

    await expect(strategy.execute(baseQuery, ctx)).rejects.toThrow('No fallback analytics service');
  });

  it('should delegate generateSql to fallback', async () => {
    const fallbackService = {
      query: vi.fn(),
      getMeta: vi.fn(),
      generateSql: vi.fn().mockResolvedValue({ sql: 'SELECT 1', params: [] }),
    };

    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: false, inMemory: true }),
      fallbackService,
    };

    const { sql } = await strategy.generateSql(baseQuery, ctx);
    expect(sql).toBe('SELECT 1');
  });

  it('should return placeholder SQL when fallback has no generateSql', async () => {
    const ctx = {
      getCube: () => ordersCube,
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: false, inMemory: true }),
      fallbackService: { query: vi.fn(), getMeta: vi.fn() },
    };

    const { sql } = await strategy.generateSql(baseQuery, ctx);
    expect(sql).toContain('InMemoryStrategy');
  });
});

// ─────────────────────────────────────────────────────────────────
// AnalyticsService (Orchestrator)
// ─────────────────────────────────────────────────────────────────

describe('AnalyticsService', () => {
  it('should use NativeSQLStrategy when driver supports native SQL', async () => {
    const mockRows = [{ count: 42 }];
    const service = new AnalyticsService({
      cubes: [ordersCube],
      logger: silentLogger,
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: true, inMemory: false }),
      executeRawSql: vi.fn().mockResolvedValue(mockRows),
    });

    const result = await service.query(baseQuery);
    expect(result.rows).toEqual(mockRows);
    expect(result.sql).toBeDefined(); // NativeSQL always includes sql
  });

  it('should fall back to ObjectQLStrategy when nativeSql is false', async () => {
    const mockRows = [{ status: 'pending', 'orders.count': 3, 'orders.total_amount': 100 }];
    const service = new AnalyticsService({
      cubes: [ordersCube],
      logger: silentLogger,
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: true, inMemory: false }),
      executeAggregate: vi.fn().mockResolvedValue(mockRows),
    });

    const result = await service.query(baseQuery);
    expect(result.rows).toHaveLength(1);
  });

  it('should fall back to InMemoryStrategy with fallback service', async () => {
    const mockResult: AnalyticsResult = {
      rows: [{ count: 100 }],
      fields: [{ name: 'count', type: 'number' }],
    };
    const fallback: IAnalyticsService = {
      query: vi.fn().mockResolvedValue(mockResult),
      getMeta: vi.fn().mockResolvedValue([]),
    };

    const service = new AnalyticsService({
      cubes: [ordersCube],
      logger: silentLogger,
      fallbackService: fallback,
    });

    const result = await service.query(baseQuery);
    expect(result).toEqual(mockResult);
    expect(fallback.query).toHaveBeenCalled();
  });

  it('should throw when no strategy can handle the query', async () => {
    const service = new AnalyticsService({
      cubes: [ordersCube],
      logger: silentLogger,
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: false, inMemory: false }),
    });

    await expect(service.query(baseQuery)).rejects.toThrow('No strategy can handle');
  });

  it('should throw when cube name is missing', async () => {
    const service = new AnalyticsService({ logger: silentLogger });
    await expect(service.query({ measures: ['count'] })).rejects.toThrow('Cube name is required');
  });

  it('should return cube metadata via getMeta()', async () => {
    const service = new AnalyticsService({
      cubes: [ordersCube],
      logger: silentLogger,
    });

    const meta = await service.getMeta();
    expect(meta).toHaveLength(1);
    expect(meta[0].name).toBe('orders');
    expect(meta[0].measures.length).toBeGreaterThan(0);
    expect(meta[0].dimensions.length).toBeGreaterThan(0);
  });

  it('should filter getMeta() by cube name', async () => {
    const service = new AnalyticsService({
      cubes: [ordersCube],
      logger: silentLogger,
    });

    const meta = await service.getMeta('orders');
    expect(meta).toHaveLength(1);
    expect(meta[0].name).toBe('orders');

    const empty = await service.getMeta('nonexistent');
    expect(empty).toHaveLength(0);
  });

  it('should generate SQL via generateSql()', async () => {
    const service = new AnalyticsService({
      cubes: [ordersCube],
      logger: silentLogger,
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
      executeRawSql: vi.fn(),
    });

    const { sql } = await service.generateSql(baseQuery);
    expect(sql).toContain('SELECT');
    expect(sql).toContain('COUNT(*)');
  });

  it('should expose cubeRegistry for external cube registration', () => {
    const service = new AnalyticsService({ logger: silentLogger });
    expect(service.cubeRegistry).toBeInstanceOf(CubeRegistry);
    expect(service.cubeRegistry.size).toBe(0);

    service.cubeRegistry.register(ordersCube);
    expect(service.cubeRegistry.size).toBe(1);
  });

  it('should support strategy priority ordering', async () => {
    // Custom strategy at priority 5 (before NativeSQL at 10)
    const customStrategy = {
      name: 'CustomStrategy',
      priority: 5,
      canHandle: () => true,
      execute: vi.fn().mockResolvedValue({ rows: [{ custom: true }], fields: [] }),
      generateSql: vi.fn().mockResolvedValue({ sql: 'CUSTOM', params: [] }),
    };

    const service = new AnalyticsService({
      cubes: [ordersCube],
      logger: silentLogger,
      strategies: [customStrategy],
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: true, inMemory: false }),
      executeRawSql: vi.fn(),
    });

    const result = await service.query(baseQuery);
    expect(customStrategy.execute).toHaveBeenCalled();
    expect(result.rows[0]).toEqual({ custom: true });
  });
});
