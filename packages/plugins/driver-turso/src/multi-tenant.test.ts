// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, afterEach } from 'vitest';
import { createMultiTenantRouter, type MultiTenantRouter } from '../src/multi-tenant.js';
import { TursoDriver } from '../src/turso-driver.js';
import { SqlDriver } from '@objectstack/driver-sql';

describe('Multi-Tenant Router', () => {
  let router: MultiTenantRouter | null = null;

  afterEach(async () => {
    if (router) {
      await router.destroyAll();
      router = null;
    }
  });

  // ── Configuration Validation ───────────────────────────────────────────

  it('should throw if urlTemplate is missing', () => {
    expect(() => createMultiTenantRouter({ urlTemplate: '' })).toThrow();
  });

  it('should throw if urlTemplate has no {tenant} placeholder', () => {
    expect(() => createMultiTenantRouter({ urlTemplate: ':memory:' })).toThrow('{tenant}');
  });

  // ── Tenant Driver Creation ─────────────────────────────────────────────

  it('should create a TursoDriver for a tenant', async () => {
    router = createMultiTenantRouter({
      urlTemplate: 'file:/tmp/test-turso-mt-{tenant}.db',
    });

    const driver = await router.getDriverForTenant('acme');
    expect(driver).toBeInstanceOf(TursoDriver);
    expect(driver).toBeInstanceOf(SqlDriver);
    expect(driver.name).toBe('com.objectstack.driver.turso');
  });

  it('should cache drivers and return same instance', async () => {
    router = createMultiTenantRouter({
      urlTemplate: 'file:/tmp/test-turso-cache-{tenant}.db',
    });

    const driver1 = await router.getDriverForTenant('acme');
    const driver2 = await router.getDriverForTenant('acme');
    expect(driver1).toBe(driver2);
  });

  it('should create separate drivers per tenant', async () => {
    router = createMultiTenantRouter({
      urlTemplate: 'file:/tmp/test-turso-sep-{tenant}.db',
    });

    const driver1 = await router.getDriverForTenant('tenant-a');
    const driver2 = await router.getDriverForTenant('tenant-b');
    expect(driver1).not.toBe(driver2);
    expect(router.getCacheSize()).toBe(2);
  });

  // ── Tenant ID Validation ───────────────────────────────────────────────

  it('should reject empty tenantId', async () => {
    router = createMultiTenantRouter({
      urlTemplate: 'file:/tmp/test-turso-val-{tenant}.db',
    });

    await expect(router.getDriverForTenant('')).rejects.toThrow();
  });

  it('should reject invalid tenantId with special characters', async () => {
    router = createMultiTenantRouter({
      urlTemplate: 'file:/tmp/test-turso-val2-{tenant}.db',
    });

    await expect(router.getDriverForTenant('a')).rejects.toThrow();
    await expect(router.getDriverForTenant('../escape')).rejects.toThrow();
  });

  it('should accept valid tenantId', async () => {
    router = createMultiTenantRouter({
      urlTemplate: 'file:/tmp/test-turso-accept-{tenant}.db',
    });

    const driver = await router.getDriverForTenant('valid-tenant');
    expect(driver).toBeDefined();
  });

  // ── Cache Management ───────────────────────────────────────────────────

  it('should report cache size', async () => {
    router = createMultiTenantRouter({
      urlTemplate: 'file:/tmp/test-turso-size-{tenant}.db',
    });

    expect(router.getCacheSize()).toBe(0);
    await router.getDriverForTenant('tenant-1');
    expect(router.getCacheSize()).toBe(1);
    await router.getDriverForTenant('tenant-2');
    expect(router.getCacheSize()).toBe(2);
  });

  it('should invalidate cache for a tenant', async () => {
    router = createMultiTenantRouter({
      urlTemplate: 'file:/tmp/test-turso-inv-{tenant}.db',
    });

    await router.getDriverForTenant('to-invalidate');
    expect(router.getCacheSize()).toBe(1);

    router.invalidateCache('to-invalidate');
    expect(router.getCacheSize()).toBe(0);
  });

  it('should destroy all cached drivers', async () => {
    router = createMultiTenantRouter({
      urlTemplate: 'file:/tmp/test-turso-destroy-{tenant}.db',
    });

    await router.getDriverForTenant('destroy-a');
    await router.getDriverForTenant('destroy-b');
    expect(router.getCacheSize()).toBe(2);

    await router.destroyAll();
    expect(router.getCacheSize()).toBe(0);
  });

  // ── Lifecycle Callbacks ────────────────────────────────────────────────

  it('should call onTenantCreate when a new tenant is provisioned', async () => {
    const created: string[] = [];

    router = createMultiTenantRouter({
      urlTemplate: 'file:/tmp/test-turso-cb-{tenant}.db',
      onTenantCreate: async (tenantId) => {
        created.push(tenantId);
      },
    });

    await router.getDriverForTenant('callback-test');
    expect(created).toEqual(['callback-test']);

    // Second call should use cache, not trigger callback
    await router.getDriverForTenant('callback-test');
    expect(created.length).toBe(1);
  });

  it('should call onTenantEvict when a tenant is invalidated', async () => {
    const evicted: string[] = [];

    router = createMultiTenantRouter({
      urlTemplate: 'file:/tmp/test-turso-evict-{tenant}.db',
      onTenantEvict: async (tenantId) => {
        evicted.push(tenantId);
      },
    });

    await router.getDriverForTenant('evict-test');
    router.invalidateCache('evict-test');
    // Allow async callback to complete
    await new Promise((r) => setTimeout(r, 50));
    expect(evicted).toEqual(['evict-test']);
  });

  // ── CRUD through Multi-Tenant Driver ───────────────────────────────────

  it('should perform CRUD operations through a tenant driver', async () => {
    router = createMultiTenantRouter({
      urlTemplate: 'file:/tmp/test-turso-crud-{tenant}.db',
    });

    const driver = await router.getDriverForTenant('crud-test');

    // Sync schema
    await driver.syncSchema('tasks', {
      name: 'tasks',
      fields: {
        title: { type: 'string' },
        done: { type: 'boolean' },
      },
    });

    // Create
    const task = await driver.create('tasks', { title: 'Test Task', done: false });
    expect(task.title).toBe('Test Task');
    expect(task.id).toBeDefined();

    // Read
    const found = await driver.find('tasks', {});
    expect(found.length).toBe(1);

    // Update
    await driver.update('tasks', task.id as string, { done: true });
    const updated = await driver.findOne('tasks', task.id as any);
    // SQLite stores boolean as 0/1, formatOutput converts back
    expect(updated!.done).toBeTruthy();

    // Delete
    const deleted = await driver.delete('tasks', task.id as string);
    expect(deleted).toBe(true);

    const count = await driver.count('tasks');
    expect(count).toBe(0);
  });
});
