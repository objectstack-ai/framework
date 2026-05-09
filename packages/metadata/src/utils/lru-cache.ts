// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Generic LRU (Least Recently Used) cache with optional TTL.
 *
 * Implementation notes:
 * - Backed by a `Map`, which preserves insertion order. We promote entries on
 *   read by deleting and re-inserting, so the oldest entry is always
 *   `map.keys().next()`.
 * - TTL is checked lazily on `get` / `has`. Expired entries are evicted on
 *   access; we do not run a background sweeper to keep the implementation
 *   side-effect free in serverless / edge runtimes.
 * - Set `maxSize <= 0` to disable the size cap; set `ttl <= 0` (or omit) to
 *   disable expiration.
 *
 * Designed for `DatabaseLoader` read-path caching — see
 * `packages/metadata/src/loaders/database-loader.ts`.
 */
export interface LRUCacheOptions {
  /** Maximum number of entries; when exceeded, the LRU entry is evicted. */
  maxSize?: number;
  /** Time-to-live in milliseconds. Zero or undefined disables TTL. */
  ttl?: number;
}

interface Entry<V> {
  value: V;
  expiresAt: number; // 0 means "never"
}

export class LRUCache<K, V> {
  private readonly map = new Map<K, Entry<V>>();
  private readonly maxSize: number;
  private readonly ttl: number;
  private hits = 0;
  private misses = 0;

  constructor(options: LRUCacheOptions = {}) {
    this.maxSize = options.maxSize && options.maxSize > 0 ? options.maxSize : 0;
    this.ttl = options.ttl && options.ttl > 0 ? options.ttl : 0;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expiresAt !== 0 && entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }
    // Promote to most-recently-used.
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.maxSize > 0 && this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next();
      if (!oldest.done) this.map.delete(oldest.value);
    }
    this.map.set(key, {
      value,
      expiresAt: this.ttl > 0 ? Date.now() + this.ttl : 0,
    });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  /** Diagnostic counters — useful for `metrics` endpoints. */
  stats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.map.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }

  /** Resets hit/miss counters without dropping cached entries. */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}
