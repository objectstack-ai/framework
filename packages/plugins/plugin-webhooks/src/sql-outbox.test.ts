// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * SqlWebhookOutbox contract test.
 *
 * Validates that `SqlWebhookOutbox` honours the same `IWebhookOutbox`
 * semantics as `MemoryWebhookOutbox`, but on top of `IDataEngine`. We use
 * a hand-rolled `FakeDataEngine` instead of booting ObjectQL + a real
 * driver because:
 *
 *   1. The interesting bug surface is the *claim race* (UPDATE ... WHERE
 *      status='pending' must reject losers atomically). FakeDataEngine
 *      models this exactly.
 *   2. Faster + zero glue.
 *
 * Coverage:
 *   - enqueue dedup (by event_id + webhook_id)
 *   - claim → ack happy path
 *   - claim ignores rows in other partitions
 *   - claim ignores rows whose next_retry_at is in the future
 *   - claim reaps stale in_flight rows past claim_ttl
 *   - ack(failure) increments attempts and schedules retry
 *   - ack(dead) marks terminal
 *   - concurrent claim() from many "workers" never double-claims a row
 */

import { describe, expect, it } from 'vitest';
import type { IDataEngine } from '@objectstack/spec/contracts';
import { SqlWebhookOutbox } from './sql-outbox.js';
import { hashPartition } from './partition.js';
import type { EnqueueInput } from './outbox.js';

// ---------------------------------------------------------------------------
// FakeDataEngine — models the subset of ObjectQL semantics SqlWebhookOutbox
// relies on. Atomic per-call: every `update` claims the JS event loop until
// it returns, mirroring how a single SQL statement holds row locks.
// ---------------------------------------------------------------------------

interface AnyRow {
    [k: string]: any;
}

class FakeDataEngine implements IDataEngine {
    readonly tables = new Map<string, AnyRow[]>();

    private get(table: string): AnyRow[] {
        if (!this.tables.has(table)) this.tables.set(table, []);
        return this.tables.get(table)!;
    }

    async find(table: string, q?: any): Promise<any[]> {
        const rows = this.get(table).filter((r) => matchWhere(r, q?.where));
        const limit = q?.limit ?? rows.length;
        return rows.slice(0, limit).map((r) => projectFields(r, q?.fields));
    }

    async findOne(table: string, q?: any): Promise<any> {
        const rows = await this.find(table, { ...q, limit: 1 });
        return rows[0] ?? null;
    }

    async insert(table: string, data: any): Promise<any> {
        const arr = Array.isArray(data) ? data : [data];
        for (const row of arr) {
            // Enforce the unique index that the real SQL schema declares.
            if (
                this.get(table).some(
                    (r) =>
                        r.event_id === row.event_id &&
                        r.webhook_id === row.webhook_id,
                )
            ) {
                throw new Error('UNIQUE constraint: event_id+webhook_id');
            }
            this.get(table).push({ ...row });
        }
        return arr;
    }

    async update(table: string, data: any, opts?: any): Promise<any> {
        const rows = this.get(table);
        let n = 0;
        for (const r of rows) {
            if (matchWhere(r, opts?.where)) {
                Object.assign(r, data);
                n += 1;
                if (!opts?.multi) break;
            }
        }
        return { affected: n };
    }

    async delete(table: string, opts?: any): Promise<any> {
        const rows = this.get(table);
        const keep = rows.filter((r) => !matchWhere(r, opts?.where));
        const n = rows.length - keep.length;
        this.tables.set(table, keep);
        return { affected: n };
    }

    async count(table: string, q?: any): Promise<number> {
        return this.get(table).filter((r) => matchWhere(r, q?.where)).length;
    }

    async aggregate(): Promise<any[]> {
        throw new Error('not implemented for tests');
    }
}

function projectFields(row: AnyRow, fields?: string[]): AnyRow {
    if (!fields || fields.length === 0) return { ...row };
    const out: AnyRow = {};
    for (const f of fields) out[f] = row[f];
    return out;
}

function matchWhere(row: AnyRow, where: any): boolean {
    if (!where || Object.keys(where).length === 0) return true;
    for (const [key, cond] of Object.entries(where)) {
        if (key === '$or') {
            const arr = cond as any[];
            if (!arr.some((c) => matchWhere(row, c))) return false;
            continue;
        }
        if (key === '$and') {
            const arr = cond as any[];
            if (!arr.every((c) => matchWhere(row, c))) return false;
            continue;
        }
        if (cond === null) {
            if (row[key] != null) return false;
            continue;
        }
        if (typeof cond === 'object' && !Array.isArray(cond)) {
            for (const [op, val] of Object.entries(cond as any)) {
                switch (op) {
                    case '$lt':
                        if (!(row[key] != null && row[key] < (val as any))) return false;
                        break;
                    case '$lte':
                        if (!(row[key] != null && row[key] <= (val as any))) return false;
                        break;
                    case '$gt':
                        if (!(row[key] != null && row[key] > (val as any))) return false;
                        break;
                    case '$gte':
                        if (!(row[key] != null && row[key] >= (val as any))) return false;
                        break;
                    case '$in':
                        if (!(val as any[]).includes(row[key])) return false;
                        break;
                    case '$ne':
                        if (row[key] === val) return false;
                        break;
                    default:
                        throw new Error(`FakeDataEngine: unsupported op ${op}`);
                }
            }
            continue;
        }
        if (row[key] !== cond) return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const PARTITIONS = 8;

function newOutbox() {
    const engine = new FakeDataEngine();
    const outbox = new SqlWebhookOutbox(engine, { partitionCount: PARTITIONS });
    return { engine, outbox };
}

function input(webhookId: string, eventId: string): EnqueueInput {
    return {
        webhookId,
        eventId,
        eventType: 'data.record.created',
        url: 'https://example.test/hook',
        payload: { hello: 'world' },
    };
}

describe('SqlWebhookOutbox', () => {
    it('enqueue inserts a row with precomputed partition_key', async () => {
        const { engine, outbox } = newOutbox();
        const id = await outbox.enqueue(input('wh-1', 'ev-1'));

        const stored = await engine.findOne('sys_webhook_delivery', {
            where: { id },
        });
        expect(stored.partition_key).toBe(hashPartition('wh-1', PARTITIONS));
        expect(stored.status).toBe('pending');
    });

    it('enqueue dedups by (event_id, webhook_id)', async () => {
        const { outbox } = newOutbox();
        const a = await outbox.enqueue(input('wh-1', 'ev-1'));
        const b = await outbox.enqueue(input('wh-1', 'ev-1'));
        expect(a).toBe(b);
    });

    it('enqueue tolerates concurrent dup INSERTs via unique-index fallback', async () => {
        const { engine, outbox } = newOutbox();
        // Pre-seed a winner row, then make the SqlOutbox think no row exists
        // by inserting *after* its findOne — to simulate a real race we just
        // call enqueue twice and confirm both return the same id.
        const [a, b] = await Promise.all([
            outbox.enqueue(input('wh-1', 'ev-1')),
            outbox.enqueue(input('wh-1', 'ev-1')),
        ]);
        expect(a).toBe(b);
        const all = await engine.find('sys_webhook_delivery', {});
        expect(all).toHaveLength(1);
    });

    it('claim returns a row and marks it in_flight', async () => {
        const { engine, outbox } = newOutbox();
        const id = await outbox.enqueue(input('wh-1', 'ev-1'));

        const claimed = await outbox.claim({
            nodeId: 'node-A',
            limit: 10,
            claimTtlMs: 60_000,
        });
        expect(claimed.map((c) => c.id)).toEqual([id]);

        const stored = await engine.findOne('sys_webhook_delivery', {
            where: { id },
        });
        expect(stored.status).toBe('in_flight');
        expect(stored.claimed_by).toBe('node-A');
    });

    it('claim filters by partition', async () => {
        const { outbox } = newOutbox();
        // Find two webhook ids that fall in different partitions.
        const ids: string[] = [];
        for (let i = 0; i < 50 && ids.length < 2; i++) {
            const wh = `wh-${i}`;
            const p = hashPartition(wh, PARTITIONS);
            if (ids.length === 0) ids.push(wh);
            else if (hashPartition(ids[0], PARTITIONS) !== p) ids.push(wh);
        }
        const [whP0, whP1] = ids;
        const p0 = hashPartition(whP0, PARTITIONS);
        const p1 = hashPartition(whP1, PARTITIONS);

        await outbox.enqueue(input(whP0, 'ev-a'));
        await outbox.enqueue(input(whP1, 'ev-b'));

        const claimed = await outbox.claim({
            nodeId: 'node-A',
            limit: 10,
            claimTtlMs: 60_000,
            partition: { index: p0, count: PARTITIONS },
        });
        expect(claimed).toHaveLength(1);
        expect(claimed[0].webhookId).toBe(whP0);
        expect(p0).not.toBe(p1);
    });

    it('claim skips rows whose next_retry_at is in the future', async () => {
        const { engine, outbox } = newOutbox();
        const id = await outbox.enqueue(input('wh-1', 'ev-1'));
        // Manually set a future retry.
        await engine.update(
            'sys_webhook_delivery',
            { next_retry_at: Date.now() + 60_000 },
            { where: { id } },
        );

        const claimed = await outbox.claim({
            nodeId: 'node-A',
            limit: 10,
            claimTtlMs: 60_000,
        });
        expect(claimed).toHaveLength(0);
    });

    it('claim reaps stale in_flight rows past claim_ttl', async () => {
        const { engine, outbox } = newOutbox();
        const id = await outbox.enqueue(input('wh-1', 'ev-1'));
        // Manually pretend a dead worker claimed it 5 minutes ago.
        await engine.update(
            'sys_webhook_delivery',
            {
                status: 'in_flight',
                claimed_by: 'dead-node',
                claimed_at: Date.now() - 300_000,
            },
            { where: { id } },
        );

        const claimed = await outbox.claim({
            nodeId: 'node-A',
            limit: 10,
            claimTtlMs: 60_000,
        });
        expect(claimed.map((c) => c.id)).toEqual([id]);
        expect(claimed[0].claimedBy).toBe('node-A');
    });

    it('ack(success) marks success and increments attempts', async () => {
        const { engine, outbox } = newOutbox();
        const id = await outbox.enqueue(input('wh-1', 'ev-1'));
        await outbox.claim({ nodeId: 'A', limit: 10, claimTtlMs: 60_000 });
        await outbox.ack(id, { success: true, httpStatus: 200, durationMs: 12 });

        const stored = await engine.findOne('sys_webhook_delivery', {
            where: { id },
        });
        expect(stored.status).toBe('success');
        expect(stored.attempts).toBe(1);
        expect(stored.claimed_by).toBeNull();
    });

    it('ack(failure) schedules retry with status=pending', async () => {
        const { engine, outbox } = newOutbox();
        const id = await outbox.enqueue(input('wh-1', 'ev-1'));
        await outbox.claim({ nodeId: 'A', limit: 10, claimTtlMs: 60_000 });
        const retryAt = Date.now() + 5_000;
        await outbox.ack(id, {
            success: false,
            httpStatus: 503,
            error: 'upstream',
            nextRetryAt: retryAt,
            durationMs: 15,
        });

        const stored = await engine.findOne('sys_webhook_delivery', {
            where: { id },
        });
        expect(stored.status).toBe('pending');
        expect(stored.attempts).toBe(1);
        expect(stored.next_retry_at).toBe(retryAt);
        expect(stored.error).toBe('upstream');
    });

    it('ack(dead) marks terminal', async () => {
        const { engine, outbox } = newOutbox();
        const id = await outbox.enqueue(input('wh-1', 'ev-1'));
        await outbox.claim({ nodeId: 'A', limit: 10, claimTtlMs: 60_000 });
        await outbox.ack(id, {
            success: false,
            httpStatus: 400,
            error: 'bad request',
            dead: true,
            durationMs: 5,
        });

        const stored = await engine.findOne('sys_webhook_delivery', {
            where: { id },
        });
        expect(stored.status).toBe('dead');
        expect(stored.next_retry_at).toBeNull();
    });

    it('concurrent claim() never double-claims a row', async () => {
        // 200 rows, 10 "workers" all racing on the same partition. Each row
        // must be claimed by exactly one worker.
        const { engine, outbox } = newOutbox();
        const target = hashPartition('wh-fixed', PARTITIONS);
        for (let i = 0; i < 200; i++) {
            await outbox.enqueue(input('wh-fixed', `ev-${i}`));
        }

        const workers = Array.from({ length: 10 }, (_, i) =>
            outbox.claim({
                nodeId: `worker-${i}`,
                limit: 1000,
                claimTtlMs: 60_000,
                partition: { index: target, count: PARTITIONS },
            }),
        );
        const results = await Promise.all(workers);
        const allClaimed = results.flat();

        // Total rows claimed equals 200 (no row missed)
        expect(allClaimed.length).toBe(200);
        // Each id appears exactly once across all workers
        const ids = new Set(allClaimed.map((r) => r.id));
        expect(ids.size).toBe(200);

        // Every persisted row is now in_flight with claimed_by set
        const stored = await engine.find('sys_webhook_delivery', {});
        for (const r of stored) {
            expect(r.status).toBe('in_flight');
            expect(r.claimed_by).toMatch(/^worker-\d$/);
        }
    });

    it('list filters by status', async () => {
        const { outbox } = newOutbox();
        const id1 = await outbox.enqueue(input('wh-1', 'ev-1'));
        await outbox.enqueue(input('wh-2', 'ev-2'));
        await outbox.claim({ nodeId: 'A', limit: 10, claimTtlMs: 60_000 });
        await outbox.ack(id1, { success: true, httpStatus: 200, durationMs: 1 });

        const success = await outbox.list({ status: 'success' });
        expect(success.map((r) => r.id)).toEqual([id1]);

        const inFlight = await outbox.list({ status: 'in_flight' });
        expect(inFlight).toHaveLength(1);
    });

    describe('redeliver', () => {
        it('resets a success row back to pending with attempts=0', async () => {
            const { outbox } = newOutbox();
            const id = await outbox.enqueue(input('wh-1', 'ev-1'));
            await outbox.claim({ nodeId: 'A', limit: 10, claimTtlMs: 60_000 });
            await outbox.ack(id, { success: true, httpStatus: 200, durationMs: 5 });

            const row = await outbox.redeliver(id);
            expect(row.status).toBe('pending');
            expect(row.attempts).toBe(0);
            expect(row.claimedBy).toBeUndefined();
            expect(row.claimedAt).toBeUndefined();
            expect(row.nextRetryAt).toBeUndefined();
            expect(row.error).toBeUndefined();
            expect(row.responseCode).toBeUndefined();
            expect(row.responseBody).toBeUndefined();
            // Original immutable fields preserved
            expect(row.url).toBe('https://example.test/hook');
            expect(row.payload).toEqual({ hello: 'world' });
        });

        it('resets a dead row back to pending and clears retry backoff', async () => {
            const { outbox } = newOutbox();
            const id = await outbox.enqueue(input('wh-1', 'ev-1'));
            await outbox.claim({ nodeId: 'A', limit: 10, claimTtlMs: 60_000 });
            await outbox.ack(id, {
                success: false,
                error: 'final',
                dead: true,
                durationMs: 5,
            });

            const row = await outbox.redeliver(id);
            expect(row.status).toBe('pending');
            expect(row.attempts).toBe(0);
            expect(row.error).toBeUndefined();
            expect(row.nextRetryAt).toBeUndefined();
        });

        it('throws not_found when row does not exist', async () => {
            const { outbox } = newOutbox();
            await expect(outbox.redeliver('missing')).rejects.toMatchObject({
                code: 'not_found',
            });
        });

        it('throws not_eligible for pending rows', async () => {
            const { outbox } = newOutbox();
            const id = await outbox.enqueue(input('wh-1', 'ev-1'));
            await expect(outbox.redeliver(id)).rejects.toMatchObject({
                code: 'not_eligible',
            });
        });

        it('throws not_eligible for in_flight rows', async () => {
            const { outbox } = newOutbox();
            const id = await outbox.enqueue(input('wh-1', 'ev-1'));
            await outbox.claim({ nodeId: 'A', limit: 10, claimTtlMs: 60_000 });
            await expect(outbox.redeliver(id)).rejects.toMatchObject({
                code: 'not_eligible',
            });
        });

        it('redelivered row is immediately claimable again', async () => {
            const { outbox } = newOutbox();
            const id = await outbox.enqueue(input('wh-1', 'ev-1'));
            await outbox.claim({ nodeId: 'A', limit: 10, claimTtlMs: 60_000 });
            await outbox.ack(id, { success: true, httpStatus: 200, durationMs: 1 });

            await outbox.redeliver(id);

            const claimed = await outbox.claim({
                nodeId: 'B',
                limit: 10,
                claimTtlMs: 60_000,
            });
            expect(claimed.map((r) => r.id)).toContain(id);
        });
    });
});
