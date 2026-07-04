// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import type { BetterAuthOptions } from 'better-auth';
import type { ICacheService } from '@objectstack/spec/contracts';

type SecondaryStorage = NonNullable<BetterAuthOptions['secondaryStorage']>;

/**
 * ADR-0069 D2 — adapt the kernel `cache` service into a better-auth
 * `secondaryStorage`. When wired, better-auth uses it for **rate-limit
 * counters** (`rateLimit.storage: 'secondary-storage'`) and session caching —
 * so both become **shared across nodes iff the cache service is shared**.
 *
 * In a single-node deployment the cache is memory-backed and this behaves like
 * the default per-process store. In a multi-node deployment the operator
 * configures the cache service with the Redis adapter (already supported by
 * `@objectstack/service-cache`), and rate limiting is then enforced against a
 * single shared counter — closing the "each node counts independently, so an
 * attacker rotates nodes to bypass the limit" hole (ADR-0069 D2).
 *
 * better-auth's `secondaryStorage` contract is string-valued: `get` returns the
 * stored string (or null), `set` takes a string value + optional TTL (seconds),
 * `delete` removes it. We map straight onto `ICacheService`, translating
 * `undefined` (miss) → `null`.
 *
 * NOTE on atomicity: better-auth's secondary-storage rate-limit path uses
 * get→compute→set (not an atomic increment) unless the storage exposes
 * `increment`. `ICacheService` has no atomic increment, so under high
 * concurrency two nodes can read the same counter and both admit a request — a
 * small over-count, acceptable for a rate limiter and still strictly better
 * than the per-node independent counters it replaces. A future cache adapter
 * exposing atomic INCR can add an `increment` method here for exact counting.
 */
export function cacheSecondaryStorage(cache: ICacheService): SecondaryStorage {
  return {
    get: async (key: string): Promise<string | null> => {
      const v = await cache.get<string>(key);
      return v === undefined ? null : v;
    },
    set: async (key: string, value: string, ttl?: number): Promise<void> => {
      await cache.set(key, value, ttl);
    },
    delete: async (key: string): Promise<void> => {
      await cache.delete(key);
    },
  };
}
