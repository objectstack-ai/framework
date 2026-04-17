// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';
import { DriverFactory } from './driver-factory';
import type { DriverConfig } from '@objectstack/spec/cloud';

describe('DriverFactory', () => {
  let factory: DriverFactory;

  beforeEach(() => {
    factory = new DriverFactory();
  });

  it('should generate consistent cache keys for same config', () => {
    const config1: DriverConfig = {
      driver: 'turso',
      databaseUrl: 'libsql://test.turso.io',
      authToken: 'token-123',
    };

    const config2: DriverConfig = {
      driver: 'turso',
      databaseUrl: 'libsql://test.turso.io',
      authToken: 'token-123',
    };

    const key1 = (factory as any).getCacheKey(config1);
    const key2 = (factory as any).getCacheKey(config2);

    expect(key1).toBe(key2);
    expect(key1).toBe('turso:libsql://test.turso.io');
  });

  it('should generate different cache keys for different configs', () => {
    const config1: DriverConfig = {
      driver: 'turso',
      databaseUrl: 'libsql://test1.turso.io',
      authToken: 'token-123',
    };

    const config2: DriverConfig = {
      driver: 'turso',
      databaseUrl: 'libsql://test2.turso.io',
      authToken: 'token-456',
    };

    const key1 = (factory as any).getCacheKey(config1);
    const key2 = (factory as any).getCacheKey(config2);

    expect(key1).not.toBe(key2);
  });

  it('should generate cache key for SQL config', () => {
    const config: DriverConfig = {
      driver: 'sql',
      dialect: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
    };

    const key = (factory as any).getCacheKey(config);
    expect(key).toBe('sql:postgresql:localhost:5432:testdb');
  });

  it('should generate cache key for Memory config', () => {
    const config: DriverConfig = {
      driver: 'memory',
      persistent: true,
      dataFile: '/data/memory.db',
    };

    const key = (factory as any).getCacheKey(config);
    expect(key).toBe('memory:/data/memory.db');
  });

  it('should generate cache key for ephemeral Memory config', () => {
    const config: DriverConfig = {
      driver: 'memory',
      persistent: false,
    };

    const key = (factory as any).getCacheKey(config);
    expect(key).toBe('memory:ephemeral');
  });

  it('should generate cache key for SQLite config', () => {
    const config: DriverConfig = {
      driver: 'sqlite',
      filename: '/data/tenant.db',
    };

    const key = (factory as any).getCacheKey(config);
    expect(key).toBe('sqlite:/data/tenant.db');
  });

  it('should generate cache key for Custom config', () => {
    const config: DriverConfig = {
      driver: 'custom',
      driverName: 'my-driver',
      config: { endpoint: 'https://api.example.com' },
    };

    const key = (factory as any).getCacheKey(config);
    expect(key).toContain('custom:my-driver:');
  });

  it('should clear cache', () => {
    factory.clearCache();
    expect(factory.getCacheSize()).toBe(0);
  });
});
