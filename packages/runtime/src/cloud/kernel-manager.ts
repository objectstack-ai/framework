// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectKernel } from '@objectstack/core';

/**
 * Factory contract for instantiating a per-project {@link ObjectKernel}.
 *
 * Given a `environmentId`, the factory is expected to:
 * 1. Read control-plane metadata (`sys_environment` + credentials + subscribed packages).
 * 2. Construct a fresh `ObjectKernel` with project-scoped driver + plugins + Apps.
 * 3. Return a **bootstrapped** kernel ready to serve requests.
 */
export interface EnvironmentKernelFactory {
  create(environmentId: string): Promise<ObjectKernel>;
}

interface CachedEntry {
  kernel: ObjectKernel;
  createdAt: number;
  lastAccess: number;
  /**
   * Wall-clock ms of the most recent freshness probe (see
   * `freshnessProbe`). Throttles upstream probe rate to at most
   * `staleCheckIntervalMs` per env.
   */
  lastStaleCheckAt: number;
}

export interface KernelManagerConfig {
  factory: EnvironmentKernelFactory;
  /** Maximum number of kernels to keep resident. Defaults to 32. */
  maxSize?: number;
  /**
   * Time-to-live (ms). Kernels idle longer than this are evicted on next
   * access. `0` disables TTL expiry. Defaults to 15 minutes.
   */
  ttlMs?: number;
  /**
   * Optional logger (duck-typed). Falls back to `console` when omitted.
   */
  logger?: { info?: (...a: any[]) => void; warn?: (...a: any[]) => void; error?: (...a: any[]) => void };
  /**
   * Optional upstream-change detector. When set, every cache hit older
   * than `staleCheckIntervalMs` triggers this probe before returning the
   * cached kernel. Returning `true` evicts the kernel and forces a
   * rebuild, so changes to the control-plane state that don't reach
   * this process via push (marketplace installs, artifact republish,
   * etc.) become visible without waiting for the LRU TTL to expire.
   *
   * The probe should be cheap (single small GET). Errors thrown here
   * are caught and treated as "still fresh" so a brief upstream
   * outage doesn't churn every cached kernel — the worst case is
   * stale-by-`ttlMs`, which is what we had before adding the probe.
   *
   * `builtAtMs` is the kernel's `createdAt` time so the probe can
   * compare against an upstream "last changed at" timestamp.
   */
  freshnessProbe?: (environmentId: string, builtAtMs: number) => Promise<boolean>;
  /**
   * Minimum gap between successive freshness probes for the same env.
   * Defaults to 10 seconds — enough to avoid hammering the control
   * plane on tight render loops while still keeping the user's
   * post-install refresh perceived as immediate.
   */
  staleCheckIntervalMs?: number;
}

/**
 * LRU + TTL cache of per-project {@link ObjectKernel} instances.
 *
 * Implements ADR-0003 multi-kernel scheduling: each project gets an
 * isolated kernel (App/plugin/metadata namespaces) that is lazily built
 * on first request and evicted under memory / idle pressure. Concurrent
 * `getOrCreate()` calls for the same environmentId share a single in-flight
 * factory invocation (singleflight).
 */
export class KernelManager {
  private readonly factory: EnvironmentKernelFactory;
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly logger: NonNullable<KernelManagerConfig['logger']>;
  private readonly cache = new Map<string, CachedEntry>();
  private readonly pending = new Map<string, Promise<ObjectKernel>>();
  private readonly freshnessProbe?: KernelManagerConfig['freshnessProbe'];
  private readonly staleCheckIntervalMs: number;

  constructor(config: KernelManagerConfig) {
    this.factory = config.factory;
    this.maxSize = config.maxSize ?? 32;
    this.ttlMs = config.ttlMs ?? 15 * 60 * 1000;
    this.logger = config.logger ?? console;
    this.freshnessProbe = config.freshnessProbe;
    this.staleCheckIntervalMs = config.staleCheckIntervalMs ?? 10_000;
  }

  /** Returns the currently cached environmentIds (ordered by insertion). */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /** Cache size for diagnostics. */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Resolve or construct the kernel for `environmentId`.
   *
   * - Cache hit (fresh): bumps `lastAccess` and returns immediately.
   * - Cache hit (TTL expired): evicts then falls through to factory.
   * - Cache miss: dedupes concurrent callers through `pending`.
   */
  async getOrCreate(environmentId: string): Promise<ObjectKernel> {
    const existing = this.cache.get(environmentId);
    if (existing) {
      if (this.ttlMs > 0 && Date.now() - existing.lastAccess > this.ttlMs) {
        await this.evict(environmentId);
      } else {
        // Throttled upstream freshness check. Probe errors are swallowed
        // so a brief control-plane outage doesn't churn the cache; the
        // worst case is stale-by-ttlMs, our prior behaviour.
        if (this.freshnessProbe) {
          const now = Date.now();
          if (now - existing.lastStaleCheckAt >= this.staleCheckIntervalMs) {
            existing.lastStaleCheckAt = now;
            let stale = false;
            try {
              stale = await this.freshnessProbe(environmentId, existing.createdAt);
            } catch (err) {
              this.logger.warn?.('[KernelManager] freshness probe failed', { environmentId, err });
            }
            if (stale) {
              this.logger.info?.('[KernelManager] kernel evicted by freshness probe', { environmentId });
              await this.evict(environmentId);
              // fall through to rebuild
            } else {
              existing.lastAccess = Date.now();
              return existing.kernel;
            }
          } else {
            existing.lastAccess = Date.now();
            return existing.kernel;
          }
        } else {
          existing.lastAccess = Date.now();
          return existing.kernel;
        }
      }
    }

    const inflight = this.pending.get(environmentId);
    if (inflight) return inflight;

    const promise = (async () => {
      const kernel = await this.factory.create(environmentId);
      const now = Date.now();
      this.cache.set(environmentId, { kernel, createdAt: now, lastAccess: now, lastStaleCheckAt: now });
      await this.enforceMaxSize();
      return kernel;
    })();

    this.pending.set(environmentId, promise);
    try {
      return await promise;
    } finally {
      this.pending.delete(environmentId);
    }
  }

  /**
   * Evict the kernel for `environmentId` and invoke `kernel.shutdown()`.
   * No-op when the entry is absent.
   */
  async evict(environmentId: string): Promise<void> {
    const entry = this.cache.get(environmentId);
    if (!entry) return;
    this.cache.delete(environmentId);
    try {
      await entry.kernel.shutdown();
    } catch (err) {
      this.logger.error?.('[KernelManager] shutdown failed', { environmentId, err });
    }
  }

  /** Evict all resident kernels. Used on runtime shutdown. */
  async evictAll(): Promise<void> {
    const ids = Array.from(this.cache.keys());
    await Promise.all(ids.map((id) => this.evict(id)));
  }

  private async enforceMaxSize(): Promise<void> {
    while (this.cache.size > this.maxSize) {
      // Find least-recently-accessed entry.
      let oldestKey: string | undefined;
      let oldestAccess = Infinity;
      for (const [key, entry] of this.cache) {
        if (entry.lastAccess < oldestAccess) {
          oldestAccess = entry.lastAccess;
          oldestKey = key;
        }
      }
      if (!oldestKey) return;
      await this.evict(oldestKey);
    }
  }
}
