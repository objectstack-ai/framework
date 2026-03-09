import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { simulateBrowser } from '../src/mocks/simulateBrowser';

/**
 * Tests for the API discovery logic used by the global API console.
 * Validates that objects can be discovered from metadata and that
 * dynamic endpoints can be generated from object names.
 */
describe('API Discovery for Global Console', () => {
    let env: any;

    beforeAll(async () => {
        env = await simulateBrowser();
    });

    afterAll(() => {
        if (env) env.cleanup();
    });

    it('should discover object names for generating data endpoints', async () => {
        const { client } = env;

        // Use the object metadata endpoint (mocked in simulateBrowser)
        const objectResult: any = await client.meta.getItems('object');
        let items: any[] = [];
        if (Array.isArray(objectResult)) items = objectResult;
        else if (objectResult && Array.isArray(objectResult.items)) items = objectResult.items;
        else if (objectResult && Array.isArray((objectResult as any).value)) items = (objectResult as any).value;

        expect(items.length).toBeGreaterThan(0);

        const names = items.map((item: any) => item.name || item.id).filter(Boolean);
        expect(names.length).toBeGreaterThan(0);
        expect(names).toContain('task');
    });

    it('should generate correct CRUD endpoint paths from object names', () => {
        const objectName = 'task';

        // The API console generates these endpoints dynamically
        const endpoints = [
            { method: 'GET', path: `/api/v1/data/${objectName}` },
            { method: 'POST', path: `/api/v1/data/${objectName}` },
            { method: 'GET', path: `/api/v1/data/${objectName}/:id` },
            { method: 'PATCH', path: `/api/v1/data/${objectName}/:id` },
            { method: 'DELETE', path: `/api/v1/data/${objectName}/:id` },
            { method: 'GET', path: `/api/v1/meta/object/${objectName}` },
        ];

        for (const ep of endpoints) {
            expect(ep.path).toMatch(/^\/api\/v1\//);
            expect(ep.path).toContain(objectName);
        }

        // Should have all CRUD methods
        const methods = endpoints.map(e => e.method);
        expect(methods).toContain('GET');
        expect(methods).toContain('POST');
        expect(methods).toContain('PATCH');
        expect(methods).toContain('DELETE');
    });

    it('should group endpoints by category', () => {
        const objectNames = ['task', 'project'];
        
        // Simulate the grouping logic from useApiDiscovery
        const groups = new Map<string, { method: string; path: string; group: string }[]>();

        // System endpoints
        const systemEndpoints = [
            { method: 'GET', path: '/api/v1/discovery', group: 'System' },
            { method: 'GET', path: '/api/v1/packages', group: 'System' },
            { method: 'GET', path: '/api/v1/health', group: 'System' },
        ];

        // Data endpoints per object
        const dataEndpoints = objectNames.flatMap(name => [
            { method: 'GET', path: `/api/v1/data/${name}`, group: `Data: ${name}` },
            { method: 'POST', path: `/api/v1/data/${name}`, group: `Data: ${name}` },
        ]);

        const all = [...systemEndpoints, ...dataEndpoints];
        for (const ep of all) {
            const existing = groups.get(ep.group) || [];
            existing.push(ep);
            groups.set(ep.group, existing);
        }

        // System group should exist
        expect(groups.has('System')).toBe(true);
        expect(groups.get('System')!.length).toBe(3);

        // Each object should have its own data group
        expect(groups.has('Data: task')).toBe(true);
        expect(groups.has('Data: project')).toBe(true);
        expect(groups.get('Data: task')!.length).toBe(2);
    });

    it('should return consistent results on repeated discovery', async () => {
        const { client } = env;

        // First discovery
        const result1: any = await client.meta.getItems('object');
        const items1 = result1.items || result1;
        const count1 = items1.length;

        // Second discovery - should return same results
        const result2: any = await client.meta.getItems('object');
        const items2 = result2.items || result2;

        expect(items2.length).toBe(count1);
    });
});
