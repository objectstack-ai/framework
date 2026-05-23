// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { MetadataManager } from './metadata-manager';
import { MemoryLoader } from './loaders/memory-loader';
import type { IPubSub, PubSubMessage } from '@objectstack/spec/contracts';

vi.mock('@objectstack/core', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

/**
 * Tiny in-test pub/sub double — same semantics as MemoryPubSub from
 * @objectstack/service-cluster but inlined here to keep this package's
 * test deps zero.
 */
class TestPubSub implements IPubSub {
    private subs = new Map<string, Set<(m: PubSubMessage<unknown>) => void>>();

    async publish<T>(channel: string, payload: T): Promise<void> {
        const bucket = this.subs.get(channel);
        if (!bucket) return;
        for (const h of Array.from(bucket)) {
            h({ channel, payload, publishedAt: Date.now() });
        }
    }
    subscribe<T>(channel: string, handler: (m: PubSubMessage<T>) => void) {
        let bucket = this.subs.get(channel);
        if (!bucket) { bucket = new Set(); this.subs.set(channel, bucket); }
        const wrapped = handler as (m: PubSubMessage<unknown>) => void;
        bucket.add(wrapped);
        return () => { bucket!.delete(wrapped); };
    }
    async close(): Promise<void> { this.subs.clear(); }
}

const flush = () => new Promise<void>((r) => setImmediate(r));

function makeManager(): MetadataManager {
    return new MetadataManager({
        formats: ['json'],
        loaders: [new MemoryLoader()],
    });
}

describe('MetadataManager — cluster pub/sub bridge', () => {
    it('replays remote events through local watchers', async () => {
        const bus = new TestPubSub();
        const mgr = makeManager();
        mgr.attachClusterPubSub(bus, 'node-B');

        const received: unknown[] = [];
        mgr.subscribe('object', (evt) => { received.push(evt); });

        await bus.publish('metadata.changed', {
            originNode: 'node-A',
            type: 'object',
            event: { type: 'changed', name: 'account', timestamp: Date.now() },
        });
        await flush();

        expect(received).toHaveLength(1);
        expect((received[0] as { name: string }).name).toBe('account');
    });

    it('suppresses loopback events (originNode === local)', async () => {
        const bus = new TestPubSub();
        const mgr = makeManager();
        mgr.attachClusterPubSub(bus, 'node-A');

        const received: unknown[] = [];
        mgr.subscribe('object', (evt) => { received.push(evt); });

        await bus.publish('metadata.changed', {
            originNode: 'node-A',
            type: 'object',
            event: { type: 'changed', name: 'account', timestamp: Date.now() },
        });
        await flush();

        expect(received).toHaveLength(0);
    });

    it('cross-node: A publish reaches B but not back to A', async () => {
        const bus = new TestPubSub();
        const mgrA = makeManager();
        const mgrB = makeManager();
        mgrA.attachClusterPubSub(bus, 'node-A');
        mgrB.attachClusterPubSub(bus, 'node-B');

        const a: unknown[] = [];
        const b: unknown[] = [];
        mgrA.subscribe('object', (e) => a.push(e));
        mgrB.subscribe('object', (e) => b.push(e));

        // Simulate manager A emitting a watch event by going through the
        // public publish surface directly (we don't have a repository
        // attached, so we drive the bus by hand — same path the
        // production code takes inside notifyWatchers).
        await bus.publish('metadata.changed', {
            originNode: 'node-A',
            type: 'object',
            event: { type: 'changed', name: 'task', timestamp: Date.now() },
        });
        await flush();

        expect(a).toHaveLength(0);                              // A skips its own
        expect(b).toHaveLength(1);                              // B replays
        expect((b[0] as { name: string }).name).toBe('task');
    });

    it('detachClusterPubSub stops replay and is idempotent', async () => {
        const bus = new TestPubSub();
        const mgr = makeManager();
        mgr.attachClusterPubSub(bus, 'node-B');

        const received: unknown[] = [];
        mgr.subscribe('object', (e) => received.push(e));

        mgr.detachClusterPubSub();
        mgr.detachClusterPubSub(); // idempotent

        await bus.publish('metadata.changed', {
            originNode: 'node-A',
            type: 'object',
            event: { type: 'changed', name: 'x', timestamp: Date.now() },
        });
        await flush();

        expect(received).toHaveLength(0);
    });

    it('re-attaching with same (pubsub,nodeId) is a no-op', async () => {
        const bus = new TestPubSub();
        const mgr = makeManager();

        const off1 = mgr.attachClusterPubSub(bus, 'node-B');
        const off2 = mgr.attachClusterPubSub(bus, 'node-B'); // should not double-subscribe

        const received: unknown[] = [];
        mgr.subscribe('object', (e) => received.push(e));

        await bus.publish('metadata.changed', {
            originNode: 'node-A',
            type: 'object',
            event: { type: 'changed', name: 'view_a', timestamp: Date.now() },
        });
        await flush();

        expect(received).toHaveLength(1);
        off1(); off2();
    });

    it('drops malformed payloads silently', async () => {
        const bus = new TestPubSub();
        const mgr = makeManager();
        mgr.attachClusterPubSub(bus, 'node-B');

        const received: unknown[] = [];
        mgr.subscribe('object', (e) => received.push(e));

        await bus.publish('metadata.changed', { originNode: 'node-A' }); // missing type/event
        await bus.publish('metadata.changed', null);
        await flush();

        expect(received).toHaveLength(0);
    });
});
