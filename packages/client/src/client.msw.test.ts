import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { LiteKernel } from '@objectstack/core';
import { ObjectQLPlugin, SchemaRegistry } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { MSWPlugin } from '@objectstack/plugin-msw';
import { ObjectStackClient } from './index';

// 127.0.0.1 usage logic remains
const BASE_URL = 'http://127.0.0.1';

describe('ObjectStackClient (with MSW Plugin)', () => {
    let kernel: LiteKernel;
    let mswPlugin: MSWPlugin;
    let server: any;

    beforeAll(async () => {
        // 1. Setup Kernel
        kernel = new LiteKernel();
        kernel.use(new ObjectQLPlugin());
        
        // 2. Setup MSW Plugin (headless mode)
        mswPlugin = new MSWPlugin({
            enableBrowser: false,
            // baseUrl: '/api/v1' // Default is /api/v1
        });
        kernel.use(mswPlugin);

        // --- BROKER SHIM START ---
        // HttpDispatcher requires a broker to function. We inject a simple shim.
        (kernel as any).broker = {
            call: async (action: string, params: any, opts: any) => {
                const parts = action.split('.');
                const service = parts[0];
                const method = parts[1];
                
                if (service === 'data') {
                    const ql = kernel.getService<any>('objectql');
                    if (method === 'create') {
                         const res = await ql.insert(params.object, params.data);
                         const record = { ...params.data, ...res };
                         return { object: params.object, id: record.id || record._id, record };
                    }
                    if (method === 'get') {
                        // Delegate to protocol for proper expand/select support
                        const protocol = kernel.getService<any>('protocol');
                        if (protocol) {
                            return await protocol.getData({ object: params.object, id: params.id, expand: params.expand, select: params.select });
                        }
                        const record = await ql.findOne(params.object, { where: { id: params.id } });
                        return record ? { object: params.object, id: params.id, record } : null;
                    }
                    if (method === 'query') {
                        // Delegate to protocol for proper expand/populate support
                        const protocol = kernel.getService<any>('protocol');
                        if (protocol) {
                            return await protocol.findData({ object: params.object, query: params.query });
                        }
                        const queryOpts = params.query || {};
                        const records = await ql.find(params.object, { filter: queryOpts.filters || queryOpts.filter });
                        return { object: params.object, records, total: records.length };
                    }
                    if (method === 'find') {
                        // Delegate to protocol for proper expand/populate support
                        const protocol = kernel.getService<any>('protocol');
                        if (protocol) {
                            return await protocol.findData({ object: params.object, query: params.query });
                        }
                        const queryOpts = params.query || {};
                        const records = await ql.find(params.object, { filter: queryOpts.filters || queryOpts.filter });
                        return { object: params.object, records, total: records.length };
                    }
                }
                
                if (service === 'metadata') {
                    if (method === 'getObject') return SchemaRegistry.getObject(params.objectName);
                    if (method === 'objects') return SchemaRegistry.getAllObjects();
                }
                
                console.warn(`[BrokerShim] Action not implemented: ${action}`);
                return null;
            }
        };
        // --- BROKER SHIM END ---

        await kernel.bootstrap();

        // 3. Setup Driver & Schema
        const ql = kernel.getService<any>('objectql');
        ql.registerDriver(new InMemoryDriver(), true);

        SchemaRegistry.registerObject({
            name: 'customer',
            fields: {
                name: { type: 'text' }
            }
        });

        // Add some data
        await ql.insert('customer', { id: '101', name: 'Alice' });
        await ql.insert('customer', { id: '102', name: 'Bob' });

        // 4. Get handlers and start MSW Node Server
        const handlers = mswPlugin.getHandlers();
        
        // Manual handlers to cover gaps in MSWPlugin generation
        handlers.push(
            http.get('http://127.0.0.1/api/v1', () => {
                return HttpResponse.json({
                    name: 'ObjectOS',
                    version: '1.0.0',
                    routes: {
                        data: '/api/v1/data',
                        metadata: '/api/v1/meta',
                        auth: '/api/v1/auth'
                    },
                    capabilities: ['data', 'metadata'],
                    features: {}
                });
            }),
            
            http.get('http://127.0.0.1/api/v1/meta/object/:name', async ({ params }) => {
                 try {
                     const res = await (kernel as any).broker.call('metadata.getObject', { objectName: params.name });
                     return HttpResponse.json({ success: true, data: res });
                 } catch (e: any) { return HttpResponse.json({ success: false, error: e.message }, { status: 404 }); }
            }),

            http.get('http://127.0.0.1/api/v1/data/:object', async ({ params }) => {
                 try {
                     // Simplifying: ignoring query filters for this test
                     const res = await (kernel as any).broker.call('data.find', { object: params.object, filters: {} });
                     return HttpResponse.json({ success: true, data: res });
                 } catch (e: any) { return HttpResponse.json({ success: false, error: e.message }, { status: 500 }); }
            }),

            http.post('http://127.0.0.1/api/v1/data/:object', async ({ params, request }) => {
                 try {
                     const body = await request.json();
                     const res = await (kernel as any).broker.call('data.create', { object: params.object, data: body });
                     return HttpResponse.json({ success: true, data: res }, { status: 201 });
                 } catch (e: any) { return HttpResponse.json({ success: false, error: e.message }, { status: 500 }); }
            }),

            http.get('http://127.0.0.1/api/v1/data/:object/:id', async ({ params }) => {
                 try {
                     const res = await (kernel as any).broker.call('data.get', { object: params.object, id: params.id });
                     return HttpResponse.json({ success: true, data: res });
                 } catch (e: any) { return HttpResponse.json({ success: false, error: e.message }, { status: 404 }); }
            })
        );

        server = setupServer(...handlers);
        server.listen({ onUnhandledRequest: 'error' });
    });
    
    // Reset handlers after each test to ensure clean state
    afterEach(() => server.resetHandlers());
    
    afterAll(async () => {
        if (server) server.close();
        if (kernel) await kernel.shutdown();
    });

    it('should connect and discover endpoints', async () => {
        // MSWPlugin configured with baseUrl: '' creates handlers at root.
        // Client connects to /api/v1.
        // To make them match in THIS test file where I used baseUrl: '', 
        // I should have configured MSWPlugin with baseUrl: '/api/v1' or left default.
        
        // RE-FIXING SETUP in beforeAll (via edit).
        // If I change MSWPlugin config to default ('/api/v1'), 
        // then Client(BASE_URL).connect() -> fetches BASE_URL/api/v1 -> matches MSW handler /api/v1.
        
        const client = new ObjectStackClient({ baseUrl: BASE_URL });
        await client.connect();

        expect(client['discoveryInfo']).toBeDefined();
    });

    it('should fetch object metadata', async () => {
        const client = new ObjectStackClient({ baseUrl: BASE_URL });
        await client.connect();

        // Spec: GetMetaItemResponse = { type, name, item }
        const customerRes: any = await client.meta.getItem('object', 'customer');
        expect(customerRes).toBeDefined();
        // After unwrapResponse, we get the protocol-level response
        // The manual handler wraps as { success, data: schema }, so unwrap yields the schema
        const schema = customerRes.item || customerRes;
        expect(schema.name).toBe('customer');
    });

    it('should find data records', async () => {
        const client = new ObjectStackClient({ baseUrl: BASE_URL });
        await client.connect();

        // Spec: FindDataResponse = { object, records, total? }
        const resultsRes = await client.data.find('customer');
        expect(resultsRes.records).toBeDefined();
        expect(resultsRes.records.length).toBe(2);
        expect(resultsRes.records[0].name).toBe('Alice');
    });

    it('should get single record', async () => {
        const client = new ObjectStackClient({ baseUrl: BASE_URL });
        await client.connect();

        // Spec: GetDataResponse = { object, id, record }
        const recordRes = await client.data.get('customer', '101');
        expect(recordRes.record).toBeDefined();
        expect(recordRes.record.name).toBe('Alice');
    });

    it('should create record', async () => {
        const client = new ObjectStackClient({ baseUrl: BASE_URL });
        await client.connect();

        // Spec: CreateDataResponse = { object, id, record }
        const newRecordRes = await client.data.create('customer', { name: 'Charlie' });
        expect(newRecordRes.record).toBeDefined();
        expect(newRecordRes.record.name).toBe('Charlie');
        expect(newRecordRes.id).toBeDefined();
    });
});
