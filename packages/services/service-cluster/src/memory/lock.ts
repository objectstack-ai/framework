// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import type {
    ILock,
    LockAcquireOptions,
    LockHandle,
} from '@objectstack/spec/contracts';

/**
 * In-memory lock for single-process deployments and tests.
 *
 * Behavior:
 *   - Per-key FIFO wait queue (so `waitMs > 0` callers receive the lock
 *     in arrival order).
 *   - TTL is honored: if a holder doesn't renew before `ttlMs` elapses,
 *     the lock is auto-released and the next waiter wakes.
 *   - Fencing tokens are process-local monotonic bigints.
 */

const DEFAULT_TTL_MS = 15_000;

export interface MemoryLockOptions {
    /** Default TTL for `acquire` when caller doesn't supply one. */
    defaultTtlMs?: number;
}

interface Holder {
    fencingToken: bigint;
    expiresAt: number;
    released: boolean;
    timer?: NodeJS.Timeout;
}

interface Waiter {
    resolve: (h: LockHandle | null) => void;
    deadline: number;
    opts: LockAcquireOptions;
    timer?: NodeJS.Timeout;
}

export class MemoryLock implements ILock {
    private readonly holders = new Map<string, Holder>();
    private readonly queues = new Map<string, Waiter[]>();
    private readonly defaultTtlMs: number;
    private fenceSeq = 0n;
    private closed = false;

    constructor(opts: MemoryLockOptions = {}) {
        this.defaultTtlMs = opts.defaultTtlMs ?? DEFAULT_TTL_MS;
    }

    async acquire(key: string, opts: LockAcquireOptions = {}): Promise<LockHandle | null> {
        if (this.closed) throw new Error('MemoryLock is closed');
        const ttlMs = opts.ttlMs ?? this.defaultTtlMs;
        const waitMs = opts.waitMs ?? 0;

        if (!this.holders.has(key)) {
            return this.grant(key, ttlMs);
        }
        if (waitMs <= 0) return null;

        return new Promise<LockHandle | null>((resolve) => {
            const deadline = Date.now() + waitMs;
            const waiter: Waiter = { resolve, deadline, opts };
            const queue = this.queues.get(key) ?? [];
            queue.push(waiter);
            this.queues.set(key, queue);
            waiter.timer = setTimeout(() => {
                const q = this.queues.get(key);
                if (q) {
                    const idx = q.indexOf(waiter);
                    if (idx >= 0) q.splice(idx, 1);
                }
                resolve(null);
            }, waitMs);
        });
    }

    async withLock<T>(
        key: string,
        fn: (h: LockHandle) => Promise<T>,
        opts?: LockAcquireOptions,
    ): Promise<T | null> {
        const handle = await this.acquire(key, opts);
        if (!handle) return null;
        try {
            return await fn(handle);
        } finally {
            await handle.release();
        }
    }

    async close(): Promise<void> {
        this.closed = true;
        for (const [, holder] of this.holders) {
            if (holder.timer) clearTimeout(holder.timer);
            holder.released = true;
        }
        this.holders.clear();
        for (const [, q] of this.queues) {
            for (const w of q) {
                if (w.timer) clearTimeout(w.timer);
                w.resolve(null);
            }
        }
        this.queues.clear();
    }

    private grant(key: string, ttlMs: number): LockHandle {
        const fencingToken = ++this.fenceSeq;
        const holder: Holder = {
            fencingToken,
            expiresAt: Date.now() + ttlMs,
            released: false,
        };
        holder.timer = setTimeout(() => this.expire(key, holder), ttlMs);
        this.holders.set(key, holder);

        const self = this;
        const handle: LockHandle = {
            key,
            fencingToken,
            isHeld: () => !holder.released && self.holders.get(key) === holder,
            async renew(extendMs?: number) {
                if (holder.released || self.holders.get(key) !== holder) {
                    throw new Error(`Lock "${key}" no longer held (fence=${fencingToken})`);
                }
                const next = extendMs ?? ttlMs;
                holder.expiresAt = Date.now() + next;
                if (holder.timer) clearTimeout(holder.timer);
                holder.timer = setTimeout(() => self.expire(key, holder), next);
            },
            async release() {
                if (holder.released || self.holders.get(key) !== holder) return;
                holder.released = true;
                if (holder.timer) clearTimeout(holder.timer);
                self.holders.delete(key);
                self.handoff(key);
            },
        };
        return handle;
    }

    private expire(key: string, holder: Holder): void {
        if (holder.released) return;
        if (this.holders.get(key) !== holder) return;
        holder.released = true;
        this.holders.delete(key);
        this.handoff(key);
    }

    private handoff(key: string): void {
        const queue = this.queues.get(key);
        if (!queue || queue.length === 0) return;
        const next = queue.shift()!;
        if (next.timer) clearTimeout(next.timer);
        if (Date.now() > next.deadline) {
            next.resolve(null);
            this.handoff(key);
            return;
        }
        const ttlMs = next.opts.ttlMs ?? this.defaultTtlMs;
        next.resolve(this.grant(key, ttlMs));
        if (queue.length === 0) this.queues.delete(key);
    }
}
