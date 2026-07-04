// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { cacheSecondaryStorage } from './secondary-storage.js';

/** Minimal in-memory ICacheService stand-in. */
function makeCache() {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (k: string) => (store.has(k) ? store.get(k) : undefined)),
    set: vi.fn(async (k: string, v: unknown, _ttl?: number) => { store.set(k, v); }),
    delete: vi.fn(async (k: string) => store.delete(k)),
    has: vi.fn(async (k: string) => store.has(k)),
    clear: vi.fn(async () => store.clear()),
    stats: vi.fn(async () => ({ hits: 0, misses: 0, keys: store.size })),
  };
}

describe('cacheSecondaryStorage (ADR-0069 D2 — shared rate-limit/session store)', () => {
  it('round-trips a value through the cache service', async () => {
    const cache = makeCache();
    const ss = cacheSecondaryStorage(cache as any);
    await ss.set('k1', '{"count":1}', 60);
    expect(cache.set).toHaveBeenCalledWith('k1', '{"count":1}', 60);
    expect(await ss.get('k1')).toBe('{"count":1}');
  });

  it('maps a cache MISS (undefined) to null (better-auth contract)', async () => {
    const cache = makeCache();
    const ss = cacheSecondaryStorage(cache as any);
    expect(await ss.get('absent')).toBeNull();
  });

  it('forwards the TTL (seconds) to the cache set', async () => {
    const cache = makeCache();
    const ss = cacheSecondaryStorage(cache as any);
    await ss.set('k', 'v', 10);
    expect(cache.set).toHaveBeenCalledWith('k', 'v', 10);
  });

  it('deletes via the cache service', async () => {
    const cache = makeCache();
    const ss = cacheSecondaryStorage(cache as any);
    await ss.set('k', 'v');
    await ss.delete('k');
    expect(cache.delete).toHaveBeenCalledWith('k');
    expect(await ss.get('k')).toBeNull();
  });
});
