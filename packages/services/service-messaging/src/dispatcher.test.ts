// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { MemoryNotificationOutbox } from './memory-outbox.js';
import { NotificationDispatcher } from './dispatcher.js';
import { classifyDeliveryAttempt, nextRetryDelayMs } from './backoff.js';
import type { MessagingChannel, SendResult } from './channel.js';

function silentCtx() {
    return { logger: { info: () => {}, warn: () => {}, error: () => {} } };
}

/** A channel whose send() outcome is scripted per call. */
function scriptedChannel(id: string, results: SendResult[]): { channel: MessagingChannel; calls: number } {
    const state = { calls: 0 };
    const channel: MessagingChannel = {
        id,
        async send() {
            const r = results[Math.min(state.calls, results.length - 1)];
            state.calls += 1;
            return r;
        },
        classifyError: () => 'retryable',
    };
    return { channel, get calls() { return state.calls; } } as any;
}

function dispatcher(
    outbox: MemoryNotificationOutbox,
    channels: MessagingChannel[],
    rng = () => 0.5,
    now?: () => number,
) {
    const registry = {
        getChannel: (cid: string) => channels.find((c) => c.id === cid),
    };
    return new NotificationDispatcher({
        nodeId: 'node-test',
        outbox,
        channels: registry,
        channelContext: silentCtx(),
        rng,
        now,
        intervalMs: 10_000, // we drive ticks manually
    });
}

describe('nextRetryDelayMs', () => {
    it('follows the schedule and dead-letters after the budget', () => {
        expect(nextRetryDelayMs(1, () => 0)).toBe(800); // 1000 * 0.8
        expect(nextRetryDelayMs(5, () => 0)).toBe(2_880_000); // 3_600_000 * 0.8
        expect(nextRetryDelayMs(6)).toBeNull(); // exhausted
        expect(nextRetryDelayMs(0)).toBeNull();
    });
});

describe('classifyDeliveryAttempt', () => {
    it('success short-circuits', () => {
        expect(classifyDeliveryAttempt({ ok: true }, undefined, 0)).toEqual({ success: true });
    });
    it('permanent → dead, invalid_recipient → suppressed', () => {
        expect(classifyDeliveryAttempt({ ok: false, error: 'x' }, 'permanent', 0)).toMatchObject({ dead: true });
        expect(classifyDeliveryAttempt({ ok: false, error: 'x' }, 'invalid_recipient', 0)).toMatchObject({ suppressed: true });
    });
    it('retryable schedules nextAttemptAt until the budget is exhausted', () => {
        const r = classifyDeliveryAttempt({ ok: false, error: 'x' }, 'retryable', 0, 1000, () => 0);
        expect(r).toMatchObject({ success: false, nextAttemptAt: 1800 });
        const dead = classifyDeliveryAttempt({ ok: false, error: 'x' }, 'retryable', 5, 1000, () => 0);
        expect(dead).toMatchObject({ dead: true });
    });
});

describe('NotificationDispatcher', () => {
    it('delivers a pending row through its channel and marks it success', async () => {
        const outbox = new MemoryNotificationOutbox(1);
        const { channel } = scriptedChannel('inbox', [{ ok: true, externalId: 'inbox_1' }]);
        const seen: any[] = [];
        const sendCh: MessagingChannel = {
            id: 'inbox',
            async send(_ctx, d) { seen.push(d); return { ok: true }; },
        };
        await outbox.enqueue({ notificationId: 'e1', recipientId: 'u1', channel: 'inbox', payload: { title: 'Hi', body: 'there' } });

        const d = dispatcher(outbox, [sendCh]);
        await d.tick();

        expect(seen).toHaveLength(1);
        expect(seen[0].recipient).toBe('u1');
        expect(seen[0].notification.title).toBe('Hi');
        const rows = await outbox.list();
        expect(rows[0].status).toBe('success');
        expect(rows[0].attempts).toBe(1);
        void channel;
    });

    it('retries a failed send (status back to pending with a future nextAttemptAt)', async () => {
        const outbox = new MemoryNotificationOutbox(1);
        const failing: MessagingChannel = {
            id: 'inbox',
            async send() { return { ok: false, error: 'db down' }; },
            classifyError: () => 'retryable',
        };
        await outbox.enqueue({ notificationId: 'e1', recipientId: 'u1', channel: 'inbox', payload: { title: 'Hi' } });

        const d = dispatcher(outbox, [failing]);
        await d.tick();

        const [row] = await outbox.list();
        expect(row.status).toBe('pending');
        expect(row.attempts).toBe(1);
        expect(row.nextAttemptAt).toBeGreaterThan(Date.now());
        expect(row.error).toBe('db down');
    });

    it('dead-letters a row whose channel is not registered', async () => {
        const outbox = new MemoryNotificationOutbox(1);
        await outbox.enqueue({ notificationId: 'e1', recipientId: 'u1', channel: 'sms', payload: { title: 'Hi' } });
        const d = dispatcher(outbox, []); // no channels
        await d.tick();
        const [row] = await outbox.list();
        expect(row.status).toBe('dead');
        expect(row.error).toContain("channel 'sms' not registered");
    });

    it('eventually dead-letters after the retry budget is exhausted', async () => {
        // Shared injectable clock: advance past the largest backoff each round so
        // the row is ready, deterministically, without real timers.
        let t = 1_000;
        const clock = () => t;
        const outbox = new MemoryNotificationOutbox(1, clock);
        const failing: MessagingChannel = {
            id: 'inbox',
            async send() { return { ok: false, error: 'always fails' }; },
            classifyError: () => 'retryable',
        };
        const id = await outbox.enqueue({ notificationId: 'e1', recipientId: 'u1', channel: 'inbox', payload: { title: 'Hi' } });
        const d = dispatcher(outbox, [failing], () => 0.5, clock);

        // 6 attempts: 5 scheduled retries then dead.
        for (let i = 0; i < 6; i++) {
            t += 5_000_000; // > max backoff (3.6M × 1.2)
            await d.tick();
        }
        const [row] = await outbox.list();
        expect(row.status).toBe('dead');
        expect(row.attempts).toBe(6);
        expect(row.id).toBe(id);
    });

    it('dedups enqueue on (notification, recipient, channel)', async () => {
        const outbox = new MemoryNotificationOutbox(1);
        const a = await outbox.enqueue({ notificationId: 'e1', recipientId: 'u1', channel: 'inbox', payload: {} });
        const b = await outbox.enqueue({ notificationId: 'e1', recipientId: 'u1', channel: 'inbox', payload: {} });
        expect(a).toBe(b);
        expect(await outbox.list()).toHaveLength(1);
    });
});
