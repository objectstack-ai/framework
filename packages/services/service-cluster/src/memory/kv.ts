// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import type { IKV, KVEntry, KVSetOptions } from '@objectstack/spec/contracts';

interface Entry<T = unknown> {
    value: T;
    version: bigint;
    expiresAt?: number;
    timer?: NodeJS.Timeout;
}

/**
 * In-memory coordination KV. Supports optimistic concurrency via
 * `ifVersion` and TTL via `ttl` (seconds).
 *
 * NOT a cache, NOT a database — intended for small cluster bookkeeping.
 */
export class MemoryKV implements IKV {
    private readonly store = new Map<string, Entry>();
    private closed = false;

    async get<T = unknown>(key: string): Promise<KVEntry<T> | undefined> {
        const e = this.store.get(key);
        if (!e) return undefined;
        if (e.expiresAt && Date.now() >= e.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return {
            key,
            value: e.value as T,
            version: e.version,
            expiresAt: e.expiresAt,
        };
    }

    async set<T = unknown>(
        key: string,
        value: T,
        opts: KVSetOptions = {},
    ): Promise<KVEntry<T>> {
        if (this.closed) throw new Error('MemoryKV is closed');
        const existing = this.store.get(key);
        const existingVersion = existing
            ? existing.expiresAt && Date.now() >= existing.expiresAt
                ? 0n
                : existing.version
            : 0n;
        if (opts.ifVersion !== undefined && opts.ifVersion !== existingVersion) {
            throw new VersionMismatchError(key, opts.ifVersion, existingVersion);
        }
        if (existing?.timer) clearTimeout(existing.timer);
        const version = existingVersion + 1n;
        const expiresAt = opts.ttl && opts.ttl > 0 ? Date.now() + opts.ttl * 1000 : undefined;
        const entry: Entry<T> = { value, version, expiresAt };
        if (expiresAt) {
            entry.timer = setTimeout(() => {
                const current = this.store.get(key);
                if (current === (entry as Entry<unknown>)) this.store.delete(key);
            }, expiresAt - Date.now());
        }
        this.store.set(key, entry as Entry<unknown>);
        return { key, value, version, expiresAt };
    }

    async delete(key: string, opts: { ifVersion?: bigint } = {}): Promise<boolean> {
        const e = this.store.get(key);
        if (!e) return false;
        if (e.expiresAt && Date.now() >= e.expiresAt) {
            this.store.delete(key);
            return false;
        }
        if (opts.ifVersion !== undefined && opts.ifVersion !== e.version) {
            throw new VersionMismatchError(key, opts.ifVersion, e.version);
        }
        if (e.timer) clearTimeout(e.timer);
        this.store.delete(key);
        return true;
    }

    async cas<T = unknown>(
        key: string,
        expectedVersion: bigint,
        next: T,
        opts: Omit<KVSetOptions, 'ifVersion'> = {},
    ): Promise<KVEntry<T> | undefined> {
        try {
            return await this.set(key, next, { ...opts, ifVersion: expectedVersion });
        } catch (err) {
            if (err instanceof VersionMismatchError) return undefined;
            throw err;
        }
    }

    async close(): Promise<void> {
        this.closed = true;
        for (const [, e] of this.store) {
            if (e.timer) clearTimeout(e.timer);
        }
        this.store.clear();
    }
}

export class VersionMismatchError extends Error {
    constructor(
        public readonly key: string,
        public readonly expected: bigint,
        public readonly actual: bigint,
    ) {
        super(
            `KV version mismatch on "${key}": expected v${expected}, found v${actual}`,
        );
        this.name = 'VersionMismatchError';
    }
}
