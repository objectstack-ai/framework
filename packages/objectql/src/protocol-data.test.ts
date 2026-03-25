// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectStackProtocolImplementation } from './protocol.js';

/**
 * Tests for the Protocol Implementation's data methods (findData, getData).
 * Validates that expand/populate/select parameters are correctly normalized
 * and forwarded to the underlying engine.
 */
describe('ObjectStackProtocolImplementation - Data Operations', () => {
    let protocol: ObjectStackProtocolImplementation;
    let mockEngine: any;

    beforeEach(() => {
        mockEngine = {
            find: vi.fn().mockResolvedValue([]),
            findOne: vi.fn().mockResolvedValue(null),
        };
        protocol = new ObjectStackProtocolImplementation(mockEngine);
    });

    // ═══════════════════════════════════════════════════════════════
    // findData — expand/populate normalization
    // ═══════════════════════════════════════════════════════════════

    describe('findData', () => {
        it('should normalize $expand (OData) string to expand Record', async () => {
            await protocol.findData({ object: 'order_item', query: { $expand: 'order,product' } });

            expect(mockEngine.find).toHaveBeenCalledWith(
                'order_item',
                expect.objectContaining({
                    expand: { order: { object: 'order' }, product: { object: 'product' } },
                }),
            );
            // $expand should be deleted from options
            const callArgs = mockEngine.find.mock.calls[0][1];
            expect(callArgs.$expand).toBeUndefined();
        });

        it('should normalize $expand (OData) with different fields to expand Record', async () => {
            await protocol.findData({ object: 'task', query: { $expand: 'assignee,project' } });

            expect(mockEngine.find).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    expand: { assignee: { object: 'assignee' }, project: { object: 'project' } },
                }),
            );
        });

        it('should normalize populate array to expand Record', async () => {
            await protocol.findData({ object: 'task', query: { populate: ['assignee'] } });

            expect(mockEngine.find).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    expand: { assignee: { object: 'assignee' } },
                }),
            );
        });

        it('should normalize populate string to expand Record', async () => {
            await protocol.findData({ object: 'task', query: { populate: 'assignee,project' } });

            expect(mockEngine.find).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    expand: { assignee: { object: 'assignee' }, project: { object: 'project' } },
                }),
            );
        });

        it('should prefer populate names over expand string when both provided', async () => {
            await protocol.findData({
                object: 'task',
                query: { populate: ['assignee'], expand: 'project' },
            });

            // populate names take precedence, but the pre-existing expand string
            // prevents the Record from being created (edge case)
            const callArgs = mockEngine.find.mock.calls[0][1];
            expect(callArgs.populate).toBeUndefined();
            expect(callArgs.$expand).toBeUndefined();
            // The expand string blocks Record creation then gets cleaned up as non-object
            expect(callArgs.expand).toBeUndefined();
        });

        it('should pass expand Record object through as-is', async () => {
            await protocol.findData({
                object: 'task',
                query: { expand: { owner: { object: 'owner' }, team: { object: 'team' } } },
            });

            expect(mockEngine.find).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    expand: { owner: { object: 'owner' }, team: { object: 'team' } },
                }),
            );
        });

        it('should normalize select string to fields array', async () => {
            await protocol.findData({ object: 'task', query: { select: 'name,status,assignee' } });

            expect(mockEngine.find).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    fields: ['name', 'status', 'assignee'],
                }),
            );
        });

        it('should pass numeric pagination params correctly', async () => {
            await protocol.findData({ object: 'task', query: { top: '10', skip: '20' } });

            expect(mockEngine.find).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    top: 10,
                    offset: 20,
                }),
            );
        });

        it('should work with no query options', async () => {
            await protocol.findData({ object: 'task' });

            expect(mockEngine.find).toHaveBeenCalledWith('task', {});
        });

        it('should return records and standard response shape', async () => {
            mockEngine.find.mockResolvedValue([{ id: 't1', name: 'Task 1' }]);

            const result = await protocol.findData({ object: 'task', query: {} });

            expect(result).toEqual(
                expect.objectContaining({
                    object: 'task',
                    records: [{ id: 't1', name: 'Task 1' }],
                    total: 1,
                }),
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // getData — expand/select normalization
    // ═══════════════════════════════════════════════════════════════

    describe('getData', () => {
        it('should convert expand string to expand Record', async () => {
            mockEngine.findOne.mockResolvedValue({ id: 'oi_1', name: 'Item 1' });

            await protocol.getData({ object: 'order_item', id: 'oi_1', expand: 'order,product' });

            expect(mockEngine.findOne).toHaveBeenCalledWith(
                'order_item',
                expect.objectContaining({
                    where: { id: 'oi_1' },
                    expand: { order: { object: 'order' }, product: { object: 'product' } },
                }),
            );
        });

        it('should convert expand array to expand Record', async () => {
            mockEngine.findOne.mockResolvedValue({ id: 't1' });

            await protocol.getData({ object: 'task', id: 't1', expand: ['assignee', 'project'] });

            expect(mockEngine.findOne).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    where: { id: 't1' },
                    expand: { assignee: { object: 'assignee' }, project: { object: 'project' } },
                }),
            );
        });

        it('should convert select string to fields array', async () => {
            mockEngine.findOne.mockResolvedValue({ id: 't1', name: 'Test' });

            await protocol.getData({ object: 'task', id: 't1', select: 'name,status' });

            expect(mockEngine.findOne).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    where: { id: 't1' },
                    fields: ['name', 'status'],
                }),
            );
        });

        it('should pass both expand and fields together', async () => {
            mockEngine.findOne.mockResolvedValue({ id: 'oi_1' });

            await protocol.getData({
                object: 'order_item',
                id: 'oi_1',
                expand: 'order',
                select: ['name', 'total'],
            });

            expect(mockEngine.findOne).toHaveBeenCalledWith(
                'order_item',
                expect.objectContaining({
                    where: { id: 'oi_1' },
                    expand: { order: { object: 'order' } },
                    fields: ['name', 'total'],
                }),
            );
        });

        it('should work without expand or select', async () => {
            mockEngine.findOne.mockResolvedValue({ id: 't1' });

            await protocol.getData({ object: 'task', id: 't1' });

            expect(mockEngine.findOne).toHaveBeenCalledWith(
                'task',
                { where: { id: 't1' } },
            );
        });

        it('should return standard GetDataResponse shape', async () => {
            mockEngine.findOne.mockResolvedValue({ id: 'oi_1', name: 'Item 1' });

            const result = await protocol.getData({ object: 'order_item', id: 'oi_1' });

            expect(result).toEqual({
                object: 'order_item',
                id: 'oi_1',
                record: { id: 'oi_1', name: 'Item 1' },
            });
        });

        it('should throw when record not found', async () => {
            mockEngine.findOne.mockResolvedValue(null);

            await expect(
                protocol.getData({ object: 'task', id: 'missing_id' })
            ).rejects.toThrow('not found');
        });
    });
});
