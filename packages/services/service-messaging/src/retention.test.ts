// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { NotificationRetention, DEFAULT_RETENTION_TARGETS } from './retention.js';

function silentLogger() {
    return { info: () => {}, warn: () => {} };
}

/** A fake engine capturing every `delete(object, options)` call. */
function captureEngine(deleteImpl?: (object: string, opts: any) => any) {
    const deletes: Array<{ object: string; where: any; multi: any; context: any }> = [];
    return {
        deletes,
        engine: {
            async find() { return []; },
            async findOne() { return null; },
            async insert() { return {}; },
            async update() { return {}; },
            async delete(object: string, opts: any) {
                deletes.push({ object, where: opts?.where, multi: opts?.multi, context: opts?.context });
                return deleteImpl ? deleteImpl(object, opts) : { deletedCount: 1 };
            },
            async count() { return 0; },
            async aggregate() { return []; },
        } as any,
    };
}

const FIXED_NOW = 1_700_000_000_000; // fixed clock for deterministic cutoffs

describe('NotificationRetention', () => {
    it('prunes every target older than the cutoff, formatting the cutoff per target', async () => {
        const { engine, deletes } = captureEngine();
        const retention = new NotificationRetention({
            getData: () => engine,
            logger: silentLogger(),
            now: () => FIXED_NOW,
        });

        const outcomes = await retention.prune(30);

        // One bulk delete per default target (receipt, inbox, delivery, event).
        expect(deletes.map((d) => d.object)).toEqual(DEFAULT_RETENTION_TARGETS.map((t) => t.object));

        const cutoffMs = FIXED_NOW - 30 * 86_400_000;
        const cutoffIso = new Date(cutoffMs).toISOString();
        for (const d of deletes) {
            expect(d.multi).toBe(true);
            // Cross-tenant system context — retention is an operator policy.
            expect(d.context).toEqual({ isSystem: true });
        }
        // The delivery row stores epoch-ms; everything else stores ISO strings.
        const byObject = Object.fromEntries(deletes.map((d) => [d.object, d.where]));
        expect(byObject['sys_notification_delivery']).toEqual({ created_at: { $lt: cutoffMs } });
        expect(byObject['sys_notification']).toEqual({ created_at: { $lt: cutoffIso } });
        expect(byObject['sys_inbox_message']).toEqual({ created_at: { $lt: cutoffIso } });
        expect(byObject['sys_notification_receipt']).toEqual({ created_at: { $lt: cutoffIso } });

        expect(outcomes.every((o) => o.deleted === 1 && !o.error)).toBe(true);
    });

    it('no-ops when there is no data engine', async () => {
        const retention = new NotificationRetention({ getData: () => undefined, logger: silentLogger() });
        expect(await retention.prune(30)).toEqual([]);
    });

    it('no-ops for a non-positive retention window', async () => {
        const { engine, deletes } = captureEngine();
        const retention = new NotificationRetention({ getData: () => engine, logger: silentLogger() });
        expect(await retention.prune(0)).toEqual([]);
        expect(await retention.prune(-5)).toEqual([]);
        expect(deletes).toHaveLength(0);
    });

    it('isolates a failing target — the rest of the sweep still runs', async () => {
        const { engine, deletes } = captureEngine((object) => {
            if (object === 'sys_inbox_message') throw new Error('boom');
            return { deletedCount: 2 };
        });
        const retention = new NotificationRetention({
            getData: () => engine,
            logger: silentLogger(),
            now: () => FIXED_NOW,
        });

        const outcomes = await retention.prune(7);

        // All four were attempted despite the inbox failure.
        expect(deletes).toHaveLength(4);
        const failed = outcomes.find((o) => o.object === 'sys_inbox_message');
        expect(failed?.error).toContain('boom');
        const ok = outcomes.filter((o) => o.object !== 'sys_inbox_message');
        expect(ok.every((o) => o.deleted === 2)).toBe(true);
    });

    it('reports an undefined count when the driver returns no count', async () => {
        const { engine } = captureEngine(() => ({}));
        const retention = new NotificationRetention({
            getData: () => engine,
            logger: silentLogger(),
            now: () => FIXED_NOW,
            targets: [{ object: 'sys_notification', tsField: 'created_at', format: 'iso' }],
        });
        const outcomes = await retention.prune(1);
        expect(outcomes).toEqual([{ object: 'sys_notification', deleted: undefined }]);
    });
});
