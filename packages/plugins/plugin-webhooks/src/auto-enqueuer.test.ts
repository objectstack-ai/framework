// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AutoEnqueuer end-to-end test.
 *
 * Verifies that the bridge between `IRealtimeService` (data events) and
 * `IWebhookOutbox` (delivery rows) works as documented:
 *
 *   - On startup, subscription rules are loaded from the engine.
 *   - `data.record.created/updated/deleted` events fan out to matching
 *     `sys_webhook` rows.
 *   - The `triggers` CSV column filters which actions fire.
 *   - The `object_name` field scopes events to a specific object.
 *   - Edits to `sys_webhook` self-heal the cache without restart.
 *   - Enqueue is fire-and-forget (handler never throws or blocks).
 *   - The deterministic eventId means two replays of the same event
 *     produce one outbox row (dedup via the underlying outbox).
 */

import { describe, expect, it, vi } from 'vitest';
import type {
    IDataEngine,
    IRealtimeService,
    RealtimeEventHandler,
    RealtimeEventPayload,
} from '@objectstack/spec/contracts';
import { AutoEnqueuer } from './auto-enqueuer.js';
import { MemoryWebhookOutbox } from './memory-outbox.js';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

class FakeRealtime implements IRealtimeService {
    private subs = new Map<string, { handler: RealtimeEventHandler; opts?: any }>();
    private n = 0;

    async publish(event: RealtimeEventPayload): Promise<void> {
        for (const sub of this.subs.values()) {
            const o = sub.opts ?? {};
            if (o.object && event.object !== o.object) continue;
            await sub.handler(event);
        }
    }
    async subscribe(channel: string, handler: any, opts?: any): Promise<string> {
        const id = `s-${++this.n}`;
        this.subs.set(id, { handler, opts });
        return id;
    }
    async unsubscribe(id: string): Promise<void> {
        this.subs.delete(id);
    }
}

class FakeEngine implements IDataEngine {
    rows: Record<string, any[]> = {};

    constructor(seed?: Record<string, any[]>) {
        if (seed) this.rows = JSON.parse(JSON.stringify(seed));
    }

    async find(name: string, q?: any): Promise<any[]> {
        const all = this.rows[name] ?? [];
        if (!q?.where) return all;
        return all.filter((r) =>
            Object.entries(q.where).every(([k, v]) => r[k] === v),
        );
    }
    async findOne(name: string, q?: any): Promise<any> {
        return (await this.find(name, q))[0] ?? null;
    }
    async insert(name: string, data: any): Promise<any> {
        const arr = (this.rows[name] = this.rows[name] ?? []);
        arr.push(data);
        return data;
    }
    async update(name: string, data: any, opts?: any): Promise<any> {
        const arr = this.rows[name] ?? [];
        for (const r of arr) {
            if (
                opts?.where &&
                Object.entries(opts.where).every(([k, v]) => r[k] === v)
            ) {
                Object.assign(r, data);
            }
        }
        return { affected: 0 };
    }
    async delete(name: string, opts?: any): Promise<any> {
        const arr = this.rows[name] ?? [];
        const before = arr.length;
        this.rows[name] = arr.filter(
            (r) =>
                !(
                    opts?.where &&
                    Object.entries(opts.where).every(([k, v]) => r[k] === v)
                ),
        );
        return { affected: before - this.rows[name].length };
    }
    async count(name: string): Promise<number> {
        return (this.rows[name] ?? []).length;
    }
    async aggregate(): Promise<any[]> {
        return [];
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function webhook(over: Partial<any> = {}): any {
    return {
        id: over.id ?? 'wh-1',
        name: over.name ?? 'default',
        active: over.active ?? true,
        object_name: over.object_name ?? 'contact',
        triggers: over.triggers ?? 'create,update,delete',
        url: over.url ?? 'https://hooks.example/wh',
        method: 'POST',
        definition_json: over.definition_json,
        ...over,
    };
}

function event(
    type: 'created' | 'updated' | 'deleted',
    object: string,
    record: any,
    timestamp = '2026-05-24T00:00:00.000Z',
): RealtimeEventPayload {
    return {
        type: `data.record.${type}`,
        object,
        payload: { recordId: record.id, after: record },
        timestamp,
    };
}

async function flush() {
    // Let microtasks run — fire-and-forget enqueues return on next tick.
    await new Promise((r) => setTimeout(r, 0));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AutoEnqueuer', () => {
    it('enqueues a delivery when a matching data event fires', async () => {
        const engine = new FakeEngine({ sys_webhook: [webhook()] });
        const realtime = new FakeRealtime();
        const outbox = new MemoryWebhookOutbox();
        const ae = new AutoEnqueuer(engine, realtime, outbox, {
            refreshIntervalMs: 0,
        });
        await ae.start();

        await realtime.publish(event('created', 'contact', { id: 'c-1', name: 'Alice' }));
        await flush();

        const rows = await outbox.list();
        expect(rows).toHaveLength(1);
        expect(rows[0].url).toBe('https://hooks.example/wh');
        expect(rows[0].eventType).toBe('data.record.created');
        expect((rows[0].payload as any).recordId).toBe('c-1');
        await ae.stop();
    });

    it('skips events for other objects', async () => {
        const engine = new FakeEngine({ sys_webhook: [webhook({ object_name: 'contact' })] });
        const realtime = new FakeRealtime();
        const outbox = new MemoryWebhookOutbox();
        const ae = new AutoEnqueuer(engine, realtime, outbox, {
            refreshIntervalMs: 0,
        });
        await ae.start();

        await realtime.publish(event('created', 'lead', { id: 'l-1' }));
        await flush();

        expect(await outbox.list()).toHaveLength(0);
        await ae.stop();
    });

    it('respects the triggers CSV (create-only webhook ignores updates)', async () => {
        const engine = new FakeEngine({
            sys_webhook: [webhook({ triggers: 'create' })],
        });
        const realtime = new FakeRealtime();
        const outbox = new MemoryWebhookOutbox();
        const ae = new AutoEnqueuer(engine, realtime, outbox, {
            refreshIntervalMs: 0,
        });
        await ae.start();

        await realtime.publish(event('created', 'contact', { id: 'c-1' }));
        await realtime.publish(event('updated', 'contact', { id: 'c-1' }, '2026-05-24T00:00:01.000Z'));
        await realtime.publish(event('deleted', 'contact', { id: 'c-1' }, '2026-05-24T00:00:02.000Z'));
        await flush();

        const rows = await outbox.list();
        expect(rows).toHaveLength(1);
        expect(rows[0].eventType).toBe('data.record.created');
        await ae.stop();
    });

    it('fans out to multiple matching webhooks', async () => {
        const engine = new FakeEngine({
            sys_webhook: [
                webhook({ id: 'wh-1', name: 'slack', url: 'https://slack.test' }),
                webhook({ id: 'wh-2', name: 'analytics', url: 'https://amplitude.test' }),
            ],
        });
        const realtime = new FakeRealtime();
        const outbox = new MemoryWebhookOutbox();
        const ae = new AutoEnqueuer(engine, realtime, outbox, {
            refreshIntervalMs: 0,
        });
        await ae.start();

        await realtime.publish(event('created', 'contact', { id: 'c-1' }));
        await flush();

        const rows = await outbox.list();
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.url).sort()).toEqual([
            'https://amplitude.test',
            'https://slack.test',
        ]);
        await ae.stop();
    });

    it('skips inactive webhooks', async () => {
        const engine = new FakeEngine({
            sys_webhook: [webhook({ active: false })],
        });
        const realtime = new FakeRealtime();
        const outbox = new MemoryWebhookOutbox();
        const ae = new AutoEnqueuer(engine, realtime, outbox, {
            refreshIntervalMs: 0,
        });
        await ae.start();

        await realtime.publish(event('created', 'contact', { id: 'c-1' }));
        await flush();

        expect(await outbox.list()).toHaveLength(0);
        await ae.stop();
    });

    it('skips manual-only webhooks (no triggers)', async () => {
        const engine = new FakeEngine({
            sys_webhook: [webhook({ triggers: '' })],
        });
        const realtime = new FakeRealtime();
        const outbox = new MemoryWebhookOutbox();
        const ae = new AutoEnqueuer(engine, realtime, outbox, {
            refreshIntervalMs: 0,
        });
        await ae.start();

        await realtime.publish(event('created', 'contact', { id: 'c-1' }));
        await flush();

        expect(await outbox.list()).toHaveLength(0);
        await ae.stop();
    });

    it('self-heals the cache when sys_webhook changes', async () => {
        // Start with no webhooks; add one via the engine; the next event
        // should be enqueued without an explicit refresh() call.
        const engine = new FakeEngine({ sys_webhook: [] });
        const realtime = new FakeRealtime();
        const outbox = new MemoryWebhookOutbox();
        const ae = new AutoEnqueuer(engine, realtime, outbox, {
            refreshIntervalMs: 0,
        });
        await ae.start();

        await realtime.publish(event('created', 'contact', { id: 'c-1' }));
        await flush();
        expect(await outbox.list()).toHaveLength(0);

        // Admin adds a webhook through the API and the engine publishes
        // a data.record.created event for sys_webhook itself.
        await engine.insert('sys_webhook', webhook());
        await realtime.publish({
            type: 'data.record.created',
            object: 'sys_webhook',
            payload: { recordId: 'wh-1' },
            timestamp: '2026-05-24T00:01:00.000Z',
        });
        await flush();
        await flush(); // Two ticks: the self-heal handler itself awaits refresh

        await realtime.publish(
            event('created', 'contact', { id: 'c-2' }, '2026-05-24T00:01:01.000Z'),
        );
        await flush();

        const rows = await outbox.list();
        expect(rows).toHaveLength(1);
        expect((rows[0].payload as any).recordId).toBe('c-2');
        await ae.stop();
    });

    it('uses deterministic eventId so dedup catches replays', async () => {
        const engine = new FakeEngine({ sys_webhook: [webhook()] });
        const realtime = new FakeRealtime();
        const outbox = new MemoryWebhookOutbox();
        const ae = new AutoEnqueuer(engine, realtime, outbox, {
            refreshIntervalMs: 0,
        });
        await ae.start();

        // Publish identical event twice — outbox dedup must collapse.
        const evt = event('created', 'contact', { id: 'c-1' });
        await realtime.publish(evt);
        await realtime.publish(evt);
        await flush();

        expect(await outbox.list()).toHaveLength(1);
        await ae.stop();
    });

    it('handler is fire-and-forget (publish does not block on enqueue)', async () => {
        const engine = new FakeEngine({ sys_webhook: [webhook()] });
        const realtime = new FakeRealtime();
        const outbox = new MemoryWebhookOutbox();
        let slowResolve!: () => void;
        const blocker = new Promise<void>((res) => {
            slowResolve = res;
        });

        // Wrap outbox to make enqueue slow.
        const slow: typeof outbox = Object.assign(outbox, {
            enqueue: async (...args: Parameters<typeof outbox.enqueue>) => {
                await blocker;
                return MemoryWebhookOutbox.prototype.enqueue.apply(outbox, args);
            },
        });

        const ae = new AutoEnqueuer(engine, realtime, slow, {
            refreshIntervalMs: 0,
        });
        await ae.start();

        const before = Date.now();
        await realtime.publish(event('created', 'contact', { id: 'c-1' }));
        const elapsed = Date.now() - before;
        expect(elapsed).toBeLessThan(20); // publish must not have awaited blocker

        slowResolve();
        await flush();
        expect(await outbox.list()).toHaveLength(1);
        await ae.stop();
    });

    it('logs but swallows enqueue errors so other webhooks still fire', async () => {
        const engine = new FakeEngine({
            sys_webhook: [
                webhook({ id: 'wh-bad', url: 'https://bad.test' }),
                webhook({ id: 'wh-good', url: 'https://good.test' }),
            ],
        });
        const realtime = new FakeRealtime();
        const outbox = new MemoryWebhookOutbox();
        const orig = outbox.enqueue.bind(outbox);
        outbox.enqueue = vi.fn(async (input) => {
            if (input.webhookId === 'wh-bad') throw new Error('boom');
            return orig(input);
        });
        const warn = vi.fn();
        const ae = new AutoEnqueuer(engine, realtime, outbox, {
            refreshIntervalMs: 0,
            logger: { warn },
        });
        await ae.start();

        await realtime.publish(event('created', 'contact', { id: 'c-1' }));
        await flush();

        const rows = await outbox.list();
        expect(rows).toHaveLength(1);
        expect(rows[0].url).toBe('https://good.test');
        expect(warn).toHaveBeenCalled();
        await ae.stop();
    });
});
