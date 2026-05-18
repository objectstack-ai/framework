// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { KernelManager, type ProjectKernelFactory } from './kernel-manager.js';

/** Build a stub "kernel" with a spy-able `shutdown()` — KernelManager only uses `.shutdown()`. */
function makeStubKernel() {
  return { shutdown: vi.fn().mockResolvedValue(undefined) } as any;
}

/**
 * Build a ProjectKernelFactory whose `create()` returns a fresh stub kernel per
 * invocation. Optional `delayMs` lets us simulate concurrent in-flight builds.
 */
function makeFactory(opts: { delayMs?: number } = {}) {
  const calls: string[] = [];
  const kernels = new Map<string, any>();
  const factory: ProjectKernelFactory = {
    create: vi.fn(async (projectId: string) => {
      calls.push(projectId);
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      const k = makeStubKernel();
      kernels.set(`${projectId}#${calls.filter((c) => c === projectId).length}`, k);
      return k;
    }),
  };
  return { factory, calls, kernels };
}

describe('KernelManager', () => {
  it('caches kernels and reuses them on repeat getOrCreate()', async () => {
    const { factory } = makeFactory();
    const mgr = new KernelManager({ factory, ttlMs: 0 });

    const a1 = await mgr.getOrCreate('p1');
    const a2 = await mgr.getOrCreate('p1');

    expect(a1).toBe(a2);
    expect(factory.create).toHaveBeenCalledTimes(1);
    expect(mgr.size).toBe(1);
  });

  it('dedupes concurrent getOrCreate() for the same project (singleflight)', async () => {
    const { factory } = makeFactory({ delayMs: 20 });
    const mgr = new KernelManager({ factory });

    const [a, b, c] = await Promise.all([
      mgr.getOrCreate('p1'),
      mgr.getOrCreate('p1'),
      mgr.getOrCreate('p1'),
    ]);

    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(factory.create).toHaveBeenCalledTimes(1);
  });

  it('evicts the least-recently-used kernel when maxSize is exceeded', async () => {
    const { factory } = makeFactory();
    const mgr = new KernelManager({ factory, maxSize: 2, ttlMs: 0 });

    const k1 = await mgr.getOrCreate('p1');
    await new Promise((r) => setTimeout(r, 2));
    await mgr.getOrCreate('p2');
    await new Promise((r) => setTimeout(r, 2));
    // Touch p1 so p2 becomes LRU.
    await mgr.getOrCreate('p1');
    await new Promise((r) => setTimeout(r, 2));
    await mgr.getOrCreate('p3'); // should evict p2

    expect(mgr.keys().sort()).toEqual(['p1', 'p3']);
    // p1 survived, its kernel is untouched.
    expect(k1.shutdown).not.toHaveBeenCalled();
  });

  it('evicts on TTL expiry and recreates on next access', async () => {
    const { factory } = makeFactory();
    const mgr = new KernelManager({ factory, ttlMs: 10 });

    const k1 = await mgr.getOrCreate('p1');
    await new Promise((r) => setTimeout(r, 20));
    const k2 = await mgr.getOrCreate('p1');

    expect(k2).not.toBe(k1);
    expect(k1.shutdown).toHaveBeenCalledTimes(1);
    expect(factory.create).toHaveBeenCalledTimes(2);
  });

  it('evict() removes the entry and invokes kernel.shutdown()', async () => {
    const { factory } = makeFactory();
    const mgr = new KernelManager({ factory });

    const k1 = await mgr.getOrCreate('p1');
    await mgr.evict('p1');

    expect(k1.shutdown).toHaveBeenCalledTimes(1);
    expect(mgr.size).toBe(0);
    // Evicting an absent entry is a no-op.
    await expect(mgr.evict('nope')).resolves.toBeUndefined();
  });

  it('evictAll() shuts down every cached kernel', async () => {
    const { factory } = makeFactory();
    const mgr = new KernelManager({ factory });

    const k1 = await mgr.getOrCreate('p1');
    const k2 = await mgr.getOrCreate('p2');
    await mgr.evictAll();

    expect(k1.shutdown).toHaveBeenCalledTimes(1);
    expect(k2.shutdown).toHaveBeenCalledTimes(1);
    expect(mgr.size).toBe(0);
  });

  it('swallows kernel.shutdown() errors and logs them', async () => {
    const factory: ProjectKernelFactory = {
      create: vi.fn(async () => ({
        shutdown: vi.fn().mockRejectedValue(new Error('boom')),
      }) as any),
    };
    const errorSpy = vi.fn();
    const mgr = new KernelManager({
      factory,
      logger: { error: errorSpy },
    });

    await mgr.getOrCreate('p1');
    await expect(mgr.evict('p1')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(mgr.size).toBe(0);
  });
});
