// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createKernel } from './createKernel';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { ObjectStackClient } from '@objectstack/client';
import studioConfig from '../../objectstack.config';

/**
 * Creates a Realistic Browser Simulation
 * 
 * This harness:
 * 1. Boots the actual ObjectStack Kernel (Memory Driver)
 * 2. Sets up the MSW Node Server (Network Layer)
 * 3. Wires the Network Layer directly to the Kernel ObjectQL service
 * 4. Returns a ready-to-use Client
 */
export async function simulateBrowser() {
    // 1. Boot Kernel (Headless Mode) — config loaded from objectstack.config.ts
    const appConfig = (studioConfig as any).default || studioConfig;
    const kernel = await createKernel({
        appConfig,
        enableBrowser: false // Disable the built-in browser MSW worker
    });

    console.log('[SimulateBrowser] Kernel booted. Configuring Network Interceptors...');

    // 2. Define Network Handlers (The "Virtual Router")
    // These map HTTP requests -> Kernel ObjectQL service actions
    const ql = (kernel as any).context?.getService('objectql');
    const handlers = [
        // Discovery
        http.get('http://localhost:3000/.well-known/objectstack', () => {
             console.log('[VirtualNetwork] GET /.well-known/objectstack');
             return HttpResponse.json({
                 version: 'v1',
                 apiName: 'ObjectStack API',
                 url: '/api/v1',
                 capabilities: {
                     graphql: false,
                     search: false,
                     websockets: false,
                     files: false,
                     analytics: false,
                     hub: false
                 }
             });
        }),

        // Query / Find
        http.get('http://localhost:3000/api/v1/data/:object', async ({ params, request }) => {
            const url = new URL(request.url);
            const filters = {}; 
            url.searchParams.forEach((val, key) => {
                 (filters as any)[key] = val;
            });
            console.log(`[VirtualNetwork] GET /data/${params.object}`, filters);
            
            try {
                let all = await ql.find(params.object);
                if (!Array.isArray(all) && all && (all as any).value) all = (all as any).value;
                if (!all) all = [];
                const result = { object: params.object, records: all, total: all.length };
                return HttpResponse.json({ success: true, data: result });
            } catch (err: any) {
                return HttpResponse.json({ error: err.message }, { status: 500 });
            }
        }),

        // Create
        http.post('http://localhost:3000/api/v1/data/:object', async ({ params, request }) => {
            const body = await request.json();
            console.log(`[VirtualNetwork] POST /data/${params.object}`);
            
            try {
                const res = await ql.insert(params.object, body);
                const record = { ...body, ...res };
                const result = { object: params.object, id: record.id, record };
                return HttpResponse.json({ success: true, data: result }, { status: 201 });
            } catch (err: any) {
                return HttpResponse.json({ error: err.message }, { status: 500 });
            }
        }),

        // Update (PUT)
        http.put('http://localhost:3000/api/v1/data/:object/:id', async ({ params, request }) => {
            const body = await request.json();
            console.log(`[VirtualNetwork] PUT /data/${params.object}/${params.id}`);
            
            try {
                await ql.update(params.object, body, { where: { id: params.id } });
                const result = { object: params.object, id: params.id, record: body };
                return HttpResponse.json({ success: true, data: result });
            } catch (err: any) {
                 return HttpResponse.json({ error: err.message }, { status: 500 });
            }
        }),
        
        // Update (PATCH) - Support both verbs
        http.patch('http://localhost:3000/api/v1/data/:object/:id', async ({ params, request }) => {
            const body = await request.json();
            console.log(`[VirtualNetwork] PATCH /data/${params.object}/${params.id}`);
            
            try {
                await ql.update(params.object, body, { where: { id: params.id } });
                const result = { object: params.object, id: params.id, record: body };
                return HttpResponse.json({ success: true, data: result });
            } catch (err: any) {
                 return HttpResponse.json({ error: err.message }, { status: 500 });
            }
        }),

        // Delete
        http.delete('http://localhost:3000/api/v1/data/:object/:id', async ({ params }) => {
            console.log(`[VirtualNetwork] DELETE /data/${params.object}/${params.id}`);
            try {
                await ql.delete(params.object, { where: { id: params.id } });
                const result = { object: params.object, id: params.id, deleted: true };
                return HttpResponse.json({ success: true, data: result });
            } catch (err: any) {
                 return HttpResponse.json({ error: err.message }, { status: 500 });
            }
        }),

        // Metadata - Get all types (base route returns types)
        http.get('http://localhost:3000/api/v1/meta', async () => {
             console.log('[VirtualNetwork] GET /meta (types)');
             try {
                 const types = ql?.registry?.getRegisteredTypes?.() || [];
                 return HttpResponse.json({ success: true, data: { types } });
             } catch (err: any) {
                  return HttpResponse.json({ error: err.message }, { status: 500 });
             }
        }),

        // Metadata - Objects List (Singular & Plural support)
        http.get('http://localhost:3000/api/v1/meta/object', async () => {
             console.log('[VirtualNetwork] GET /meta/object');
             try {
                 const objects = ql?.getObjects?.() || {};
                 return HttpResponse.json({ success: true, data: objects });
             } catch (err: any) {
                  return HttpResponse.json({ error: err.message }, { status: 500 });
             }
        }),
        http.get('http://localhost:3000/api/v1/meta/objects', async () => {
             console.log('[VirtualNetwork] GET /meta/objects');
             try {
                 const objects = ql?.getObjects?.() || {};
                 return HttpResponse.json({ success: true, data: objects });
             } catch (err: any) {
                  return HttpResponse.json({ error: err.message }, { status: 500 });
             }
        }),

        // Metadata - Object Detail (Singular & Plural support)
        http.get('http://localhost:3000/api/v1/meta/object/:name', async ({ params }) => {
             console.log(`[VirtualNetwork] GET /meta/object/${params.name}`);
             try {
                 const result = ql?.registry?.getObject?.(params.name);
                 if (!result) {
                     return HttpResponse.json({ error: 'Not Found' }, { status: 404 });
                 }
                 return HttpResponse.json({ success: true, data: result });
             } catch (err: any) {
                  return HttpResponse.json({ error: err.message }, { status: 500 });
             }
        }),
        http.get('http://localhost:3000/api/v1/meta/objects/:name', async ({ params }) => {
             console.log(`[VirtualNetwork] GET /meta/objects/${params.name}`);
             try {
                 const result = ql?.registry?.getObject?.(params.name);
                 if (!result) {
                     return HttpResponse.json({ error: 'Not Found' }, { status: 404 });
                 }
                 return HttpResponse.json({ success: true, data: result });
             } catch (err: any) {
                  return HttpResponse.json({ error: err.message }, { status: 500 });
             }
        }),

        // Metadata - Generic type list (for agents, tools, etc.)
        http.get('http://localhost:3000/api/v1/meta/:type', async ({ params }) => {
             if (params.type === 'object' || params.type === 'objects') {
                 return;
             }
             console.log(`[VirtualNetwork] GET /meta/${params.type}`);
             try {
                 const items = ql?.registry?.listItems?.(params.type) || [];
                 return HttpResponse.json({ success: true, data: items });
             } catch (err: any) {
                  return HttpResponse.json({ error: err.message }, { status: 500 });
             }
        })
    ];

    // 3. Start Interceptor
    const server = setupServer(...handlers);
    server.listen({ onUnhandledRequest: 'bypass' });

    // 4. Create Client
    const client = new ObjectStackClient({
        baseUrl: 'http://localhost:3000'
    });

    return {
        kernel,
        client,
        server,
        cleanup: () => server.close()
    };
}
