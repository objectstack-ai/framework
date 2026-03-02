import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LiteKernel } from '@objectstack/core';
import { ObjectQL, ObjectQLPlugin, SchemaRegistry } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { HonoServerPlugin } from '@objectstack/plugin-hono-server';
import { ObjectStackClient } from './index';

describe('ObjectStackClient (with Hono Server)', () => {
    let baseUrl: string;
    let kernel: LiteKernel;

    beforeAll(async () => {
        // 1. Setup Kernel
        kernel = new LiteKernel();
        kernel.use(new ObjectQLPlugin());
        
        // 2. Setup Hono Plugin
        const honoPlugin = new HonoServerPlugin({ 
            port: 0,
            registerStandardEndpoints: true
        });
        kernel.use(honoPlugin);
        
        // --- BROKER SHIM START ---
        // HttpDispatcher requires a broker to function. We inject a simple shim.
        (kernel as any).broker = {
            call: async (action: string, params: any, opts: any) => {
                const parts = action.split('.');
                const service = parts[0];
                const method = parts[1];
                
                if (service === 'data') {
                    const ql = kernel.getService<any>('objectql'); // Use 'objectql' service name for clarity
                    if (method === 'create') {
                        const res = await ql.insert(params.object, params.data);
                        const record = { ...params.data, ...res };
                        return { object: params.object, id: record.id || record._id, record };
                    }
                    // Params from HttpDispatcher: { object, id, ...query }
                    if (method === 'get') {
                        // Delegate to protocol for proper expand/select support
                        const protocol = kernel.getService<any>('protocol');
                        if (protocol) {
                            return await protocol.getData({ object: params.object, id: params.id, expand: params.expand, select: params.select });
                        }
                        const record = await ql.findOne(params.object, { where: { id: params.id } });
                        return record ? { object: params.object, id: params.id, record } : null;
                    }
                    // Params from HttpDispatcher: { object, filters }
                    if (method === 'query') {
                        // Delegate to protocol for proper expand/populate support
                        const protocol = kernel.getService<any>('protocol');
                        if (protocol) {
                            return await protocol.findData({ object: params.object, query: params.query || params.filters });
                        }
                        const records = await ql.find(params.object, { filter: params.filters });
                        return { object: params.object, records, total: records.length };
                    }
                    if (method === 'find') {
                        // Delegate to protocol for proper expand/populate support
                        const protocol = kernel.getService<any>('protocol');
                        if (protocol) {
                            return await protocol.findData({ object: params.object, query: params.query || params.filters });
                        }
                        const records = await ql.find(params.object, { filter: params.filters });
                        return { object: params.object, records, total: records.length };
                    }
                }
                
                if (service === 'metadata') {
                    // ObjectQLPlugin registers itself as 'metadata' but doesn't implement all broker methods directly
                    // We use SchemaRegistry for lookups
                    if (method === 'getObject') {
                         return SchemaRegistry.getObject(params.objectName);
                    }
                    if (method === 'objects') {
                         return SchemaRegistry.getAllObjects();
                    }
                }
                
                if (service === 'auth' && method === 'login') {
                     return { token: 'mock-token', user: { id: 'admin', name: 'Admin' } };
                }

                console.warn(`[BrokerShim] Action not implemented: ${action}`);
                throw new Error(`Action ${action} not implemented in shim`);
            }
        };
        // --- BROKER SHIM END ---

        await kernel.bootstrap();

        // 3. Setup Driver
        const ql = kernel.getService<ObjectQL>('objectql');
        ql.registerDriver(new InMemoryDriver(), true);

        // 4. Load Metadata (Schema)
        SchemaRegistry.registerObject({
            name: 'customer',
            label: 'Customer',
            fields: {
                name: { type: 'text', label: 'Name' },
                email: { type: 'text', label: 'Email' }
            }
        });

        // 5. Get Port from Service
        const httpServer = kernel.getService<any>('http.server');
        const port = httpServer.getPort();
        baseUrl = `http://localhost:${port}`;

        console.log(`Test server running at ${baseUrl}`);
    });

    afterAll(async () => {
        if (kernel) await kernel.shutdown();
    });

    it('should connect to hono server and discover endpoints', async () => {
        const client = new ObjectStackClient({ baseUrl });
        await client.connect();
        
        // Client should have populated discovery info
        expect(client['discoveryInfo']).toBeDefined();
        
        // Verify endpoints from valid discovery response
        // Standard: /api/v1/data, /api/v1/meta, etc.
        const endpoints = client['discoveryInfo']!.routes;
        expect(endpoints.data).toContain('/api/v1/data');
        expect(endpoints.metadata).toContain('/api/v1/meta');
        expect(endpoints.auth).toContain('/api/v1/auth');
    });

    it('should create and retrieve data via hono', async () => {
        const client = new ObjectStackClient({ baseUrl });
        await client.connect();

        // Create — Spec: CreateDataResponse = { object, id, record }
        const createdResponse = await client.data.create('customer', {
            name: 'Hono User',
            email: 'hono@example.com'
        });
        
        expect(createdResponse.record.name).toBe('Hono User');
        expect(createdResponse.id).toBeDefined();

        // Retrieve — Spec: GetDataResponse = { object, id, record }
        const retrievedResponse = await client.data.get('customer', createdResponse.id);
        expect(retrievedResponse.record.name).toBe('Hono User');
    });

    it('should find data via hono', async () => {
        const client = new ObjectStackClient({ baseUrl });
        await client.connect();

        // Spec: FindDataResponse = { object, records, total? }
        const resultsResponse = await client.data.find('customer', {
            where: { name: 'Hono User' }
        });

        expect(resultsResponse.records.length).toBeGreaterThan(0);
        expect(resultsResponse.records[0].name).toBe('Hono User');
    });
});
