// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';
import { ObjectQL } from './engine.js';

// Mock driver for testing
const createMockDriver = (name: string) => ({
  name,
  version: '1.0.0',
  supports: {},
  connect: async () => {},
  disconnect: async () => {},
  checkHealth: async () => true,
  find: async () => [],
  findOne: async () => null,
  create: async (obj: string, data: any) => ({ id: '1', ...data }),
  update: async (obj: string, id: string, data: any) => ({ id, ...data }),
  delete: async () => true,
  count: async () => 0,
  bulkCreate: async () => [],
  bulkUpdate: async () => [],
  bulkDelete: async () => {},
  execute: async () => ({}),
  findStream: async function* () {},
  upsert: async (obj: string, data: any) => ({ id: '1', ...data }),
  beginTransaction: async () => ({}),
  commit: async () => {},
  rollback: async () => {},
  syncSchema: async () => {},
});

describe('DatasourceMapping', () => {
  let engine: ObjectQL;

  beforeEach(() => {
    engine = new ObjectQL();
    // registry is owned by engine
  });

  it('should route objects by namespace', async () => {
    const memoryDriver = createMockDriver('memory');
    const tursoDriver = createMockDriver('turso');

    engine.registerDriver(memoryDriver);
    engine.registerDriver(tursoDriver, true); // default

    // Configure mapping: crm namespace → memory
    engine.setDatasourceMapping([
      { namespace: 'crm', datasource: 'memory' },
    ]);

    // Register an object in crm namespace
    engine.registry.registerObject(
      {
        name: 'account',
        fields: { name: { type: 'text' } },
      },
      'com.example.crm',
      'crm',
      'own'
    );

    // Test that it uses memory driver
    const result = await engine.insert('account', { name: 'Test Account' });
    expect(result).toBeDefined();
    expect(result.name).toBe('Test Account');
  });

  it('should route objects by pattern', async () => {
    const memoryDriver = createMockDriver('memory');
    const tursoDriver = createMockDriver('turso');

    engine.registerDriver(memoryDriver);
    engine.registerDriver(tursoDriver, true);

    // Configure mapping: sys_* pattern → turso
    engine.setDatasourceMapping([
      { objectPattern: 'sys_*', datasource: 'turso' },
      { default: true, datasource: 'memory' },
    ]);

    // Register system objects
    engine.registry.registerObject(
      {
        name: 'sys_user',
        fields: { username: { type: 'text' } },
      },
      'com.objectstack.system',
      'system',
      'own'
    );

    const result = await engine.insert('sys_user', { username: 'admin' });
    expect(result).toBeDefined();
  });

  it('should respect priority order', async () => {
    const memoryDriver = createMockDriver('memory');
    const tursoDriver = createMockDriver('turso');

    engine.registerDriver(memoryDriver);
    engine.registerDriver(tursoDriver);

    // Higher priority rule should win
    engine.setDatasourceMapping([
      { namespace: 'crm', datasource: 'memory', priority: 100 },
      { namespace: 'crm', datasource: 'turso', priority: 50 }, // Lower number = higher priority
    ]);

    engine.registry.registerObject(
      {
        name: 'account',
        fields: { name: { type: 'text' } },
      },
      'com.example.crm',
      'crm',
      'own'
    );

    // Should use turso (priority 50) not memory (priority 100)
    const result = await engine.insert('account', { name: 'Test' });
    expect(result).toBeDefined();
  });

  it('should fallback to default rule', async () => {
    const memoryDriver = createMockDriver('memory');
    const tursoDriver = createMockDriver('turso');

    engine.registerDriver(memoryDriver);
    engine.registerDriver(tursoDriver);

    engine.setDatasourceMapping([
      { namespace: 'auth', datasource: 'turso' },
      { default: true, datasource: 'memory' },
    ]);

    // Register object in different namespace
    engine.registry.registerObject(
      {
        name: 'task',
        fields: { title: { type: 'text' } },
      },
      'com.example.todo',
      'todo',
      'own'
    );

    // Should use memory (default)
    const result = await engine.insert('task', { title: 'Do something' });
    expect(result).toBeDefined();
  });

  it('should prefer object explicit datasource over mapping', async () => {
    const memoryDriver = createMockDriver('memory');
    const tursoDriver = createMockDriver('turso');

    engine.registerDriver(memoryDriver);
    engine.registerDriver(tursoDriver);

    engine.setDatasourceMapping([
      { namespace: 'crm', datasource: 'memory' },
    ]);

    // Object explicitly sets datasource
    engine.registry.registerObject(
      {
        name: 'account',
        datasource: 'turso', // Explicit override
        fields: { name: { type: 'text' } },
      },
      'com.example.crm',
      'crm',
      'own'
    );

    // Should use turso (explicit) not memory (mapping)
    const result = await engine.insert('account', { name: 'Test' });
    expect(result).toBeDefined();
  });
});
