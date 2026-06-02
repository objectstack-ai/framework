// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Driver contract tests for the Redis cluster driver, run against
 * `ioredis-mock` so they execute without a real Redis instance in CI.
 *
 * The same suites can be invoked against a live Redis by setting
 * `RUN_REAL_REDIS=1` and providing `REDIS_URL` — see the conditional
 * `describe.skipIf` blocks at the bottom.
 */

// @ts-expect-error — ioredis-mock has no published types
import RedisMock from 'ioredis-mock';
import { describe, expect, it, vi } from 'vitest';
import {
    runLockContract,
    runKVContract,
    runCounterContract,
} from '@objectstack/service-cluster/testing';
// Load the driver entrypoint at module eval — importing it registers the
// 'redis' cluster driver as a side-effect, which `defineCluster({ driver:
// 'redis' })` then resolves. Doing this here (not via `await import()` inside
// the timed test bodies) keeps the one-time cold module-load cost out of the
// per-test 5s timeout — the wiring tests below were flaky on slow CI for
// exactly that reason (the first test paid the full import cost and timed out).
import './index.js';
import { defineCluster } from '@objectstack/service-cluster';

import { RedisPubSub } from './pubsub.js';
import { RedisLock } from './lock.js';
import { RedisKV } from './kv.js';
import { RedisCounter } from './counter.js';

// ioredis-mock shares state across instances by default, so each
// primitive gets a unique key-prefix per test to ensure isolation.
let suffix = 0;
const uniquePrefix = () => `t${++suffix}:`;
const makeClient = () => new RedisMock();

runLockContract('redis(mock)', async () =>
    new RedisLock({ client: makeClient(), keyPrefix: uniquePrefix() }),
);
runKVContract('redis(mock)', async () =>
    new RedisKV({ client: makeClient(), keyPrefix: uniquePrefix() }),
);
runCounterContract('redis(mock)', async () =>
    new RedisCounter({ client: makeClient(), keyPrefix: uniquePrefix() }),
);

// PubSub: Redis delivery is async (network roundtrip even for mock), so
// we can't reuse the synchronous contract suite. Cover the same surface
// here with explicit waits.
describe('IPubSub contract — redis(mock)', () => {
    const flush = () => new Promise<void>((r) => setTimeout(r, 10));

    it('delivers published messages to subscribers', async () => {
        const bus = new RedisPubSub({ client: makeClient(), keyPrefix: uniquePrefix() });
        const received: unknown[] = [];
        bus.subscribe<{ n: number }>('ch', (msg) => { received.push(msg.payload); });
        await flush();                                         // let SUBSCRIBE register
        await bus.publish('ch', { n: 1 });
        await bus.publish('ch', { n: 2 });
        await flush();
        expect(received).toEqual([{ n: 1 }, { n: 2 }]);
        await bus.close();
    });

    it('does not deliver to other channels', async () => {
        const bus = new RedisPubSub({ client: makeClient(), keyPrefix: uniquePrefix() });
        const h = vi.fn();
        bus.subscribe('a', h);
        await flush();
        await bus.publish('b', { x: 1 });
        await flush();
        expect(h).not.toHaveBeenCalled();
        await bus.close();
    });

    it('supports multiple subscribers per channel', async () => {
        const bus = new RedisPubSub({ client: makeClient(), keyPrefix: uniquePrefix() });
        const a = vi.fn();
        const b = vi.fn();
        bus.subscribe('ch', a);
        bus.subscribe('ch', b);
        await flush();
        await bus.publish('ch', 'hi');
        await flush();
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
        await bus.close();
    });

    it('unsubscribe stops delivery and is idempotent', async () => {
        const bus = new RedisPubSub({ client: makeClient(), keyPrefix: uniquePrefix() });
        const h = vi.fn();
        const off = bus.subscribe('ch', h);
        await flush();
        await bus.publish('ch', 1);
        await flush();
        off();
        off();
        await bus.publish('ch', 2);
        await flush();
        expect(h).toHaveBeenCalledTimes(1);
        await bus.close();
    });

    it('isolates handler errors from siblings', async () => {
        const bus = new RedisPubSub({ client: makeClient(), keyPrefix: uniquePrefix() });
        bus.subscribe('ch', () => { throw new Error('boom'); });
        const ok = vi.fn();
        bus.subscribe('ch', ok);
        await flush();
        await expect(bus.publish('ch', 1)).resolves.toBeUndefined();
        await flush();
        expect(ok).toHaveBeenCalledTimes(1);
        await bus.close();
    });

    it('close rejects further publishes', async () => {
        const bus = new RedisPubSub({ client: makeClient(), keyPrefix: uniquePrefix() });
        await bus.close();
        await expect(bus.publish('ch', 1)).rejects.toThrow(/closed/);
    });
});

describe('Redis driver — wiring', () => {
    it('exports a registerable driver and defineCluster picks it up', async () => {
        const client = makeClient();
        const cluster = defineCluster({
            driver: 'redis',
            nodeId: 'mock-node',
            driverOptions: { client, keyPrefix: uniquePrefix() },
        });
        expect(cluster.driver).toBe('redis');
        expect(cluster.nodeId).toBe('mock-node');

        expect(await cluster.counter.incr('seq')).toBe(1n);
        expect(await cluster.counter.incr('seq')).toBe(2n);

        await cluster.kv.set('k', { hello: 'world' });
        const got = await cluster.kv.get<{ hello: string }>('k');
        expect(got?.value).toEqual({ hello: 'world' });

        const handle = await cluster.lock.acquire('foo');
        expect(handle).not.toBeNull();
        expect(handle!.fencingToken).toBeGreaterThan(0n);
        await handle!.release();

        await cluster.close();
    });

    it('does NOT quit caller-owned client on close', async () => {
        const client = makeClient();
        const cluster = defineCluster({
            driver: 'redis',
            nodeId: 'mock-node-2',
            driverOptions: { client, keyPrefix: uniquePrefix() },
        });
        await cluster.close();
        await expect(client.set('post-close', '1')).resolves.toBe('OK');
    });
});
