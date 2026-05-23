// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DeliveryRetentionSweeper test.
 *
 * Verifies the retention policy applied to `sys_webhook_delivery`:
 *   - success rows older than `successTtlMs` are deleted
 *   - dead rows older than `deadTtlMs` are deleted
 *   - pending / in_flight / failed rows are NEVER auto-pruned
 *   - rows newer than the TTL stay
 *   - successTtlMs=0 disables the success sweep
 */

import { describe, expect, it } from 'vitest';
import type { IDataEngine } from '@objectstack/spec/contracts';
import { DeliveryRetentionSweeper } from './retention.js';

class FakeEngine implements IDataEngine {
    rows: any[] = [];
    async find(): Promise<any[]> {
        return this.rows;
    }
    async findOne(): Promise<any> {
        return null;
    }
    async insert(_n: string, data: any): Promise<any> {
        const arr = Array.isArray(data) ? data : [data];
        for (const r of arr) this.rows.push(r);
        return data;
    }
    async update(): Promise<any> {
        return { affected: 0 };
    }
    async delete(_name: string, opts?: any): Promise<any> {
        const before = this.rows.length;
        const where = opts?.where ?? {};
        this.rows = this.rows.filter((r) => {
            if (where.status && r.status !== where.status) return true;
            if (where.updated_at?.$lt != null && !(r.updated_at < where.updated_at.$lt))
                return true;
            return false;
        });
        return { affected: before - this.rows.length };
    }
    async count(): Promise<number> {
        return this.rows.length;
    }
    async aggregate(): Promise<any[]> {
        return [];
    }
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('DeliveryRetentionSweeper', () => {
    it('deletes old success rows past TTL', async () => {
        const engine = new FakeEngine();
        const now = Date.now();
        engine.rows.push(
            { id: 'a', status: 'success', updated_at: now - 8 * DAY },
            { id: 'b', status: 'success', updated_at: now - 6 * DAY }, // inside TTL
            { id: 'c', status: 'success', updated_at: now - 30 * DAY },
        );
        const sweeper = new DeliveryRetentionSweeper(engine, { successTtlMs: 7 * DAY });
        const res = await sweeper.sweep(now);
        expect(res.success).toBe(2);
        expect(engine.rows.map((r) => r.id)).toEqual(['b']);
    });

    it('keeps pending / in_flight / failed rows regardless of age', async () => {
        const engine = new FakeEngine();
        const now = Date.now();
        engine.rows.push(
            { id: 'p', status: 'pending', updated_at: now - 100 * DAY },
            { id: 'i', status: 'in_flight', updated_at: now - 100 * DAY },
            { id: 'f', status: 'failed', updated_at: now - 100 * DAY },
        );
        const sweeper = new DeliveryRetentionSweeper(engine);
        await sweeper.sweep(now);
        expect(engine.rows).toHaveLength(3);
    });

    it('deletes old dead rows past deadTtlMs', async () => {
        const engine = new FakeEngine();
        const now = Date.now();
        engine.rows.push(
            { id: 'd1', status: 'dead', updated_at: now - 31 * DAY },
            { id: 'd2', status: 'dead', updated_at: now - 29 * DAY }, // inside TTL
        );
        const sweeper = new DeliveryRetentionSweeper(engine, { deadTtlMs: 30 * DAY });
        const res = await sweeper.sweep(now);
        expect(res.dead).toBe(1);
        expect(engine.rows.map((r) => r.id)).toEqual(['d2']);
    });

    it('successTtlMs=0 disables the success sweep', async () => {
        const engine = new FakeEngine();
        const now = Date.now();
        engine.rows.push({ id: 'a', status: 'success', updated_at: now - 100 * DAY });
        const sweeper = new DeliveryRetentionSweeper(engine, { successTtlMs: 0 });
        const res = await sweeper.sweep(now);
        expect(res.success).toBe(0);
        expect(engine.rows).toHaveLength(1);
    });

    it('deadTtlMs=0 disables the dead sweep', async () => {
        const engine = new FakeEngine();
        const now = Date.now();
        engine.rows.push({ id: 'd', status: 'dead', updated_at: now - 100 * DAY });
        const sweeper = new DeliveryRetentionSweeper(engine, { deadTtlMs: 0 });
        const res = await sweeper.sweep(now);
        expect(res.dead).toBe(0);
        expect(engine.rows).toHaveLength(1);
    });
});
