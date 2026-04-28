// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ProjectScopeManager
 *
 * Replaces KernelManager in shared-kernel mode. Instead of managing full
 * ObjectKernel instances per project, it manages TTL/LRU eviction of
 * SCOPED service instances inside a single shared kernel.
 *
 * The kernel's PluginLoader already stores scoped instances in:
 *   scopedServices: Map<scopeId, Map<serviceName, instance>>
 *
 * This class tracks last-access timestamps and calls kernel.clearScope()
 * to release driver connections and metadata caches for idle projects.
 */

import type { ObjectKernel } from '@objectstack/core';

export interface ProjectScopeManagerConfig {
    /** Shared kernel whose scoped services this manager evicts. */
    kernel: ObjectKernel;
    /** Idle TTL in ms. Scopes not accessed within this window are evicted. Default: 15 min. */
    ttlMs?: number;
    /** Max number of active scopes. LRU eviction when exceeded. Default: 200. */
    maxSize?: number;
    /** Eviction check interval in ms. Default: 5 min. */
    checkIntervalMs?: number;
}

export class ProjectScopeManager {
    private readonly kernel: ObjectKernel;
    private readonly ttlMs: number;
    private readonly maxSize: number;
    private readonly lastAccess: Map<string, number> = new Map();
    private timer?: ReturnType<typeof setInterval>;

    constructor(config: ProjectScopeManagerConfig) {
        this.kernel = config.kernel;
        this.ttlMs = config.ttlMs ?? 15 * 60 * 1000;
        this.maxSize = config.maxSize ?? 200;
        const checkIntervalMs = config.checkIntervalMs ?? 5 * 60 * 1000;
        this.timer = setInterval(() => this.evictIdle(), checkIntervalMs);
        // Don't block Node.js exit
        if (this.timer.unref) this.timer.unref();
    }

    /**
     * Touch a scope to reset its idle TTL. Call this on every request.
     */
    touch(scopeId: string): void {
        this.lastAccess.set(scopeId, Date.now());
        if (this.lastAccess.size > this.maxSize) {
            this.evictLRU();
        }
    }

    /**
     * Evict all scopes not accessed within ttlMs.
     */
    evictIdle(): void {
        const now = Date.now();
        for (const [scopeId, ts] of this.lastAccess) {
            if (now - ts > this.ttlMs) {
                this.evict(scopeId);
            }
        }
    }

    /**
     * Evict a specific scope immediately.
     */
    evict(scopeId: string): void {
        this.lastAccess.delete(scopeId);
        this.kernel.clearScope(scopeId);
    }

    /**
     * Evict all scopes (e.g. on shutdown).
     */
    evictAll(): void {
        for (const scopeId of Array.from(this.lastAccess.keys())) {
            this.evict(scopeId);
        }
    }

    destroy(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        this.evictAll();
    }

    get activeCount(): number {
        return this.lastAccess.size;
    }

    private evictLRU(): void {
        // Evict the least recently used scope
        let oldest = Infinity;
        let oldestId: string | undefined;
        for (const [scopeId, ts] of this.lastAccess) {
            if (ts < oldest) {
                oldest = ts;
                oldestId = scopeId;
            }
        }
        if (oldestId) {
            this.evict(oldestId);
        }
    }
}
