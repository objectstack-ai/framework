// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { ObjectStackProtocolImplementation } from './protocol.js';

/**
 * ADR-0033 — package-level lifecycle beyond publish:
 *  - `discardPackageDrafts` — abandon all pending edits, revert to the published
 *    baseline (NON-destructive: drafts only, no table teardown).
 *  - `deletePackage` — remove the whole package (active + draft) and, by
 *    default, tear down each object's physical table (DESTRUCTIVE).
 *
 * These tests cover the orchestration (which per-item `deleteMetaItem` calls are
 * made, with which flags) — the teardown itself is covered in
 * protocol-publish-rollback.test.ts.
 */

describe('protocol.discardPackageDrafts', () => {
    function makeProtocol(drafts: Array<{ type: string; name: string }>) {
        const protocol = new ObjectStackProtocolImplementation({} as never);
        (protocol as any).ensureOverlayIndex = async () => {};
        (protocol as any).getOverlayRepo = () => ({ listDrafts: async () => drafts });
        const deleteMetaItem = vi.spyOn(protocol, 'deleteMetaItem' as never);
        deleteMetaItem.mockResolvedValue({ success: true } as never);
        return { protocol, deleteMetaItem };
    }

    it('discards every draft (state:draft, NO teardown) and reports success', async () => {
        const { protocol, deleteMetaItem } = makeProtocol([
            { type: 'object', name: 'course' },
            { type: 'view', name: 'course_list' },
        ]);
        const res = await protocol.discardPackageDrafts({ packageId: 'app.edu' });
        expect(deleteMetaItem).toHaveBeenCalledTimes(2);
        const first = deleteMetaItem.mock.calls[0][0] as any;
        expect(first).toMatchObject({ type: 'object', name: 'course', state: 'draft' });
        expect(first).not.toHaveProperty('dropStorage'); // never tears down published data
        expect(res).toMatchObject({ success: true, discardedCount: 2, failedCount: 0 });
    });

    it('collects per-item failures without aborting', async () => {
        const { protocol, deleteMetaItem } = makeProtocol([
            { type: 'object', name: 'course' },
            { type: 'view', name: 'course_list' },
        ]);
        (deleteMetaItem as any).mockImplementation(async (req: any) => {
            if (req.name === 'course_list') throw Object.assign(new Error('locked'), { code: 'locked' });
            return { success: true };
        });
        const res = await protocol.discardPackageDrafts({ packageId: 'app.edu' });
        expect(res.discardedCount).toBe(1);
        expect(res.failedCount).toBe(1);
        expect(res.failed[0]).toMatchObject({ name: 'course_list', code: 'locked' });
        expect(res.success).toBe(false);
    });

    it('empty package → discardedCount 0, success false', async () => {
        const { protocol, deleteMetaItem } = makeProtocol([]);
        const res = await protocol.discardPackageDrafts({ packageId: 'app.empty' });
        expect(deleteMetaItem).not.toHaveBeenCalled();
        expect(res).toMatchObject({ success: false, discardedCount: 0 });
    });
});

describe('protocol.deletePackage', () => {
    function makeProtocol(rows: Array<{ type: string; name: string; state: string; organization_id?: string | null }>) {
        const engine = { find: vi.fn(async () => rows) };
        const protocol = new ObjectStackProtocolImplementation(engine as never);
        const deleteMetaItem = vi.spyOn(protocol, 'deleteMetaItem' as never);
        deleteMetaItem.mockResolvedValue({ success: true } as never);
        return { protocol, deleteMetaItem };
    }

    it('deletes all rows, tears down active objects (dropStorage), drafts before active', async () => {
        const { protocol, deleteMetaItem } = makeProtocol([
            { type: 'object', name: 'course', state: 'active', organization_id: null },
            { type: 'object', name: 'course', state: 'draft', organization_id: null },
            { type: 'view', name: 'course_list', state: 'active', organization_id: null },
        ]);
        const res = await protocol.deletePackage({ packageId: 'app.edu' });
        expect(res).toMatchObject({ success: true, deletedCount: 3, failedCount: 0 });

        const calls = deleteMetaItem.mock.calls.map((c) => c[0] as any);
        const courseActive = calls.find((c) => c.name === 'course' && c.state === 'active');
        expect(courseActive).toMatchObject({ dropStorage: true });

        const order = calls.map((c) => `${c.name}:${c.state}`);
        expect(order.indexOf('course:draft')).toBeLessThan(order.indexOf('course:active'));
    });

    it('keepData:true removes metadata but does NOT request teardown', async () => {
        const { protocol, deleteMetaItem } = makeProtocol([
            { type: 'object', name: 'course', state: 'active', organization_id: null },
        ]);
        await protocol.deletePackage({ packageId: 'app.edu', keepData: true });
        expect((deleteMetaItem.mock.calls[0][0] as any)).not.toHaveProperty('dropStorage');
    });

    it('empty package → deletedCount 0, success false', async () => {
        const { protocol, deleteMetaItem } = makeProtocol([]);
        const res = await protocol.deletePackage({ packageId: 'app.empty' });
        expect(deleteMetaItem).not.toHaveBeenCalled();
        expect(res).toMatchObject({ success: false, deletedCount: 0 });
    });
});
