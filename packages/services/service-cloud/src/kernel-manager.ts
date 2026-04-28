// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectKernel } from '@objectstack/core';

/**
 * Factory contract for instantiating a per-project {@link ObjectKernel}.
 *
 * Given a `projectId`, the factory is expected to:
 * 1. Read control-plane metadata (`sys_project` + credentials + subscribed packages).
 * 2. Construct a fresh `ObjectKernel` with project-scoped driver + plugins + Apps.
 * 3. Return a **bootstrapped** kernel ready to serve requests.
 */
export interface ProjectKernelFactory {
  create(projectId: string): Promise<ObjectKernel>;
}

interface CachedEntry {
  kernel: ObjectKernel;
  createdAt: number;
  lastAccess: number;
}

export interface KernelManagerConfig {
  factory: ProjectKernelFactory;
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
}

/**
 * LRU + TTL cache of per-project {@link ObjectKernel} instances.
 *
 * Implements ADR-0003 multi-kernel scheduling: each project gets an
 * isolated kernel (App/plugin/metadata namespaces) that is lazily built
 * on first request and evicted under memory / idle pressure. Concurrent
 * `getOrCreate()` calls for the same projectId share a single in-flight
 * factory invocation (singleflight).
 */
export class KernelManager {
  private readonly factory: ProjectKernelFactory;
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly logger: NonNullable<KernelManagerConfig['logger']>;
  private readonly cache = new Map<string, CachedEntry>();
  private readonly pending = new Map<string, Promise<ObjectKernel>>();

  constructor(config: KernelManagerConfig) {
    this.factory = config.factory;
    this.maxSize = config.maxSize ?? 32;
    this.ttlMs = config.ttlMs ?? 15 * 60 * 1000;
    this.logger = config.logger ?? console;
  }

  /** Returns the currently cached projectIds (ordered by insertion). */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /** Cache size for diagnostics. */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Resolve or construct the kernel for `projectId`.
   *
   * - Cache hit (fresh): bumps `lastAccess` and returns immediately.
   * - Cache hit (TTL expired): evicts then falls through to factory.
   * - Cache miss: dedupes concurrent callers through `pending`.
   */
  async getOrCreate(projectId: string): Promise<ObjectKernel> {
    const existing = this.cache.get(projectId);
    if (existing) {
      if (this.ttlMs > 0 && Date.now() - existing.lastAccess > this.ttlMs) {
        await this.evict(projectId);
      } else {
        existing.lastAccess = Date.now();
        return existing.kernel;
      }
    }

    const inflight = this.pending.get(projectId);
    if (inflight) return inflight;

    const promise = (async () => {
      const kernel = await this.factory.create(projectId);
      const now = Date.now();
      this.cache.set(projectId, { kernel, createdAt: now, lastAccess: now });
      await this.enforceMaxSize();
      return kernel;
    })();

    this.pending.set(projectId, promise);
    try {
      return await promise;
    } finally {
      this.pending.delete(projectId);
    }
  }

  /**
   * Evict the kernel for `projectId` and invoke `kernel.shutdown()`.
   * No-op when the entry is absent.
   */
  async evict(projectId: string): Promise<void> {
    const entry = this.cache.get(projectId);
    if (!entry) return;
    this.cache.delete(projectId);
    try {
      await entry.kernel.shutdown();
    } catch (err) {
      this.logger.error?.('[KernelManager] shutdown failed', { projectId, err });
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
