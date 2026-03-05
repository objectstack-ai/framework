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
        it('should normalize expand string to populate array', async () => {
            await protocol.findData({ object: 'order_item', query: { expand: 'order,product' } });

            expect(mockEngine.find).toHaveBeenCalledWith(
                'order_item',
                expect.objectContaining({
                    populate: ['order', 'product'],
                }),
            );
            // expand should be deleted from options
            const callArgs = mockEngine.find.mock.calls[0][1];
            expect(callArgs.expand).toBeUndefined();
            expect(callArgs.$expand).toBeUndefined();
        });

        it('should normalize $expand (OData) to populate array', async () => {
            await protocol.findData({ object: 'task', query: { $expand: 'assignee,project' } });

            expect(mockEngine.find).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    populate: ['assignee', 'project'],
                }),
            );
        });

        it('should pass populate array as-is if already an array', async () => {
            await protocol.findData({ object: 'task', query: { populate: ['assignee'] } });

            expect(mockEngine.find).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    populate: ['assignee'],
                }),
            );
        });

        it('should normalize populate string to array', async () => {
            await protocol.findData({ object: 'task', query: { populate: 'assignee,project' } });

            expect(mockEngine.find).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    populate: ['assignee', 'project'],
                }),
            );
        });

        it('should prefer explicit populate over expand', async () => {
            await protocol.findData({
                object: 'task',
                query: { populate: ['assignee'], expand: 'project' },
            });

            // populate takes precedence; expand is not converted
            expect(mockEngine.find).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    populate: ['assignee'],
                }),
            );
        });

        it('should normalize expand array to populate array', async () => {
            await protocol.findData({ object: 'task', query: { expand: ['owner', 'team'] } });

            expect(mockEngine.find).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    populate: ['owner', 'team'],
                }),
            );
        });

        it('should normalize select string to array', async () => {
            await protocol.findData({ object: 'task', query: { select: 'name,status,assignee' } });

            expect(mockEngine.find).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    select: ['name', 'status', 'assignee'],
                }),
            );
        });

        it('should pass numeric pagination params correctly', async () => {
            await protocol.findData({ object: 'task', query: { top: '10', skip: '20' } });

            expect(mockEngine.find).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    top: 10,
                    skip: 20,
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
        it('should convert expand string to populate array', async () => {
            mockEngine.findOne.mockResolvedValue({ id: 'oi_1', name: 'Item 1' });

            await protocol.getData({ object: 'order_item', id: 'oi_1', expand: 'order,product' });

            expect(mockEngine.findOne).toHaveBeenCalledWith(
                'order_item',
                expect.objectContaining({
                    filter: { id: 'oi_1' },
                    populate: ['order', 'product'],
                }),
            );
        });

        it('should convert expand array to populate array', async () => {
            mockEngine.findOne.mockResolvedValue({ id: 't1' });

            await protocol.getData({ object: 'task', id: 't1', expand: ['assignee', 'project'] });

            expect(mockEngine.findOne).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    populate: ['assignee', 'project'],
                }),
            );
        });

        it('should convert select string to array', async () => {
            mockEngine.findOne.mockResolvedValue({ id: 't1', name: 'Test' });

            await protocol.getData({ object: 'task', id: 't1', select: 'name,status' });

            expect(mockEngine.findOne).toHaveBeenCalledWith(
                'task',
                expect.objectContaining({
                    select: ['name', 'status'],
                }),
            );
        });

        it('should pass both expand and select together', async () => {
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
                    filter: { id: 'oi_1' },
                    populate: ['order'],
                    select: ['name', 'total'],
                }),
            );
        });

        it('should work without expand or select', async () => {
            mockEngine.findOne.mockResolvedValue({ id: 't1' });

            await protocol.getData({ object: 'task', id: 't1' });

            expect(mockEngine.findOne).toHaveBeenCalledWith(
                'task',
                { filter: { id: 't1' } },
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
