import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { simulateBrowser } from '../src/mocks/simulateBrowser';

/**
 * Helper: extract records array from the API response.
 * The client strips the HTTP envelope ({ success, data }) and returns the protocol response.
 * Protocol responses use `records` (spec-compliant).
 */
function extractRecords(response: any): any[] {
    if (Array.isArray(response)) return response;
    return response?.records || response?.data || [];
}

describe('App React CRUD Integration Tests (Virtual Browser)', () => {
    let env: any;

    beforeAll(async () => {
        // Spin up the Simulation
        env = await simulateBrowser();
    });

    afterAll(() => {
        // Tear down
        if (env) env.cleanup();
    });

    it('should boot kernel and have seeded data available immediately', async () => {
        const { client } = env;

        console.log('[Test] Verifying network-to-kernel bridge...');

        // 1. Client makes HTTP Request
        // 2. MSW intercepts
        // 3. Handler calls Kernel.broker
        // 4. Kernel reads Memory Driver
        const response = await client.data.find('task', {
            top: 5
        });

        console.log('[Test] Response received:', response);

        const items = extractRecords(response);
        
        expect(items).toBeDefined();
        // Since we force seeded in createKernel, we expect 5 items (top: 5 of 8 total)
        expect(items.length).toBe(5);
        expect(items[0]).toHaveProperty('subject');
        
        // Check for 'status' as per actual seed data schema
        expect(items[0]).toHaveProperty('status');
    });

    it('should support CRUD operations via Client', async () => {
        const { client } = env;

        // CREATE
        // Client returns the protocol response: { object, id, record }
        const createResult = await client.data.create('task', {
            subject: 'Test generated task',
            status: 'not_started',
            priority: 'normal'
        });

        // Extract the actual record from the response
        const newTask = createResult?.record || createResult;
        expect(newTask).toBeDefined();
        expect(newTask.id).toBeDefined();
        expect(newTask.subject).toBe('Test generated task');

        // READ
        const fetched = await client.data.find('task', {
            filters: { id: newTask.id }
        });
        const list = extractRecords(fetched);
        expect(list).toHaveLength(1);
        expect(list[0].id).toBe(newTask.id);

        // UPDATE
        const updateResult = await client.data.update('task', newTask.id, {
            subject: 'Updated Task Title'
        });
        const updated = updateResult?.record || updateResult;
        expect(updated.subject).toBe('Updated Task Title');

        // DELETE
        await client.data.delete('task', newTask.id);
        const afterDelete = await client.data.find('task', { filters: { id: newTask.id } });
        const missingList = extractRecords(afterDelete);
        expect(missingList).toHaveLength(0);
    });

    it('should support pagination, sorting and field selection', async () => {
        const { client } = env;
        
        // 1. Test Sorting (ascending by priority)
        const sorted = await client.data.find('task', {
            sort: ['priority']
        });
        const sortedItems = extractRecords(sorted);
        expect(sortedItems.length).toBeGreaterThan(1);

        // 2. Test Pagination (Top)
        const top2 = await client.data.find('task', {
            top: 2
        });
        const top2Items = extractRecords(top2);
        expect(top2Items).toHaveLength(2);

        // 3. Test Select (only subject field + id always returned)
        const selected = await client.data.find('task', {
            top: 1,
            select: ['subject']
        });
        const selectedItems = extractRecords(selected);
        expect(selectedItems[0]).toHaveProperty('subject');
        expect(selectedItems[0]).not.toHaveProperty('priority'); // Should be excluded
        expect(selectedItems[0]).toHaveProperty('id'); // ID is always returned
    });
});
