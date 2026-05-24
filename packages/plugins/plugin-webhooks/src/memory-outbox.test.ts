// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MemoryWebhookOutbox — focused tests for behaviours not already covered
 * via `dispatcher.test.ts`. Today that's just `redeliver()` — the rest of
 * the contract is exercised end-to-end through the dispatcher path.
 */

import { describe, expect, it } from 'vitest';
import { MemoryWebhookOutbox } from './memory-outbox.js';
import type { EnqueueInput } from './outbox.js';

function input(webhookId: string, eventId: string): EnqueueInput {
    return {
        webhookId,
        eventId,
        eventType: 'data.record.created',
        url: 'https://example.test/hook',
        payload: { hello: 'world' },
    };
}

describe('MemoryWebhookOutbox.redeliver', () => {
    it('resets a success row back to pending with attempts=0', async () => {
        const outbox = new MemoryWebhookOutbox();
        const id = await outbox.enqueue(input('wh-1', 'ev-1'));
        await outbox.claim({ nodeId: 'A', limit: 10, claimTtlMs: 60_000 });
        await outbox.ack(id, { success: true, httpStatus: 200, durationMs: 1 });

        const row = await outbox.redeliver(id);
        expect(row.status).toBe('pending');
        expect(row.attempts).toBe(0);
        expect(row.claimedBy).toBeUndefined();
        expect(row.claimedAt).toBeUndefined();
        expect(row.nextRetryAt).toBeUndefined();
        expect(row.error).toBeUndefined();
        expect(row.responseCode).toBeUndefined();
        expect(row.responseBody).toBeUndefined();
        expect(row.url).toBe('https://example.test/hook');
        expect(row.payload).toEqual({ hello: 'world' });
    });

    it('resets a dead row and makes it claimable again', async () => {
        const outbox = new MemoryWebhookOutbox();
        const id = await outbox.enqueue(input('wh-1', 'ev-1'));
        await outbox.claim({ nodeId: 'A', limit: 10, claimTtlMs: 60_000 });
        await outbox.ack(id, {
            success: false,
            error: 'final',
            dead: true,
            durationMs: 5,
        });

        await outbox.redeliver(id);
        const claimed = await outbox.claim({
            nodeId: 'B',
            limit: 10,
            claimTtlMs: 60_000,
        });
        expect(claimed.map((r) => r.id)).toContain(id);
    });

    it('throws not_found when row does not exist', async () => {
        const outbox = new MemoryWebhookOutbox();
        await expect(outbox.redeliver('missing')).rejects.toMatchObject({
            code: 'not_found',
        });
    });

    it('throws not_eligible for pending rows', async () => {
        const outbox = new MemoryWebhookOutbox();
        const id = await outbox.enqueue(input('wh-1', 'ev-1'));
        await expect(outbox.redeliver(id)).rejects.toMatchObject({
            code: 'not_eligible',
        });
    });

    it('throws not_eligible for in_flight rows', async () => {
        const outbox = new MemoryWebhookOutbox();
        const id = await outbox.enqueue(input('wh-1', 'ev-1'));
        await outbox.claim({ nodeId: 'A', limit: 10, claimTtlMs: 60_000 });
        await expect(outbox.redeliver(id)).rejects.toMatchObject({
            code: 'not_eligible',
        });
    });
});
