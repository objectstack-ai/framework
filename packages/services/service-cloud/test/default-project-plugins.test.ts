// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Smoke test for the per-project default plugin slate.
 *
 * Boots a bare ObjectKernel with an in-memory driver and asserts that
 * `mountDefaultProjectPlugins` registers all six caps in the right
 * order. This is the contract the hosted runtime (objectos) and the
 * single-tenant CLI both depend on; regressing it would silently break
 * Settings / Email / Storage on hosted tenants.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ObjectKernel } from '@objectstack/core';
import { DriverPlugin } from '@objectstack/runtime';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { mountDefaultProjectPlugins } from '../src/default-project-plugins.js';

function pluginNames(kernel: ObjectKernel): string[] {
  const map: Map<string, any> = (kernel as any).plugins;
  return Array.from(map.values()).map((p: any) => p?.constructor?.name ?? p?.name ?? '');
}

describe('mountDefaultProjectPlugins', () => {
  let kernel: ObjectKernel;

  beforeEach(async () => {
    kernel = new ObjectKernel();
    await kernel.use(new DriverPlugin(new InMemoryDriver()));
  });

  it('mounts queue, job, cache, settings, email, storage in order', async () => {
    await mountDefaultProjectPlugins(kernel, { projectId: 'p1' });

    const slate = pluginNames(kernel).filter((n) =>
      /Queue|Job|Cache|Settings|Email|Storage/.test(n),
    );
    expect(slate).toEqual([
      'QueueServicePlugin',
      'JobServicePlugin',
      'CacheServicePlugin',
      'SettingsServicePlugin',
      'EmailServicePlugin',
      'StorageServicePlugin',
    ]);
  });

  it('skips individual caps when caps[<cap>] === false', async () => {
    await mountDefaultProjectPlugins(kernel, {
      projectId: 'p1',
      caps: { email: false, storage: false },
    });

    const names = pluginNames(kernel);
    expect(names.some((n) => /EmailServicePlugin/.test(n))).toBe(false);
    expect(names.some((n) => /StorageServicePlugin/.test(n))).toBe(false);
    expect(names.some((n) => /SettingsServicePlugin/.test(n))).toBe(true);
  });

  it('mounts isolated storage instances per project', async () => {
    const k1 = new ObjectKernel();
    await k1.use(new DriverPlugin(new InMemoryDriver()));
    const k2 = new ObjectKernel();
    await k2.use(new DriverPlugin(new InMemoryDriver()));

    await mountDefaultProjectPlugins(k1, {
      projectId: 'tenant-a',
      dataRoot: '/tmp/test-default-plugins',
      caps: { queue: false, job: false, cache: false, settings: false, email: false },
    });
    await mountDefaultProjectPlugins(k2, {
      projectId: 'tenant-b',
      dataRoot: '/tmp/test-default-plugins',
      caps: { queue: false, job: false, cache: false, settings: false, email: false },
    });

    const sp1 = Array.from(((k1 as any).plugins as Map<string, any>).values()).find(
      (p: any) => /Storage/.test(p?.constructor?.name ?? ''),
    );
    const sp2 = Array.from(((k2 as any).plugins as Map<string, any>).values()).find(
      (p: any) => /Storage/.test(p?.constructor?.name ?? ''),
    );
    expect(sp1).toBeDefined();
    expect(sp2).toBeDefined();
    expect(sp1).not.toBe(sp2);
  });

  it('survives missing caps gracefully (does not throw)', async () => {
    await expect(
      mountDefaultProjectPlugins(kernel, { projectId: 'p1' }),
    ).resolves.not.toThrow();
  });
});
