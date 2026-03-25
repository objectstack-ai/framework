// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Broker Shim Factory
 * 
 * Creates an in-process broker shim that bridges HttpDispatcher calls
 * to ObjectQL engine operations. Required by both MSW (browser) and
 * Hono (server) modes since the simplified kernel setup does not include
 * a full message broker.
 * 
 * @module
 */

import { SchemaRegistry } from '@objectstack/objectql';

/**
 * Minimal broker interface expected by HttpDispatcher
 */
export interface BrokerShim {
    call(action: string, params: any, opts?: any): Promise<any>;
}

/**
 * Create a broker shim bound to the given kernel instance.
 *
 * The shim delegates data/metadata/package actions to the ObjectQL engine
 * and SchemaRegistry that were registered on the kernel during bootstrap.
 */
export function createBrokerShim(kernel: any): BrokerShim {
    return {
        call: async (action: string, params: any, _opts: any) => {
            const parts = action.split('.');
            const service = parts[0];
            const method = parts[1];

            // Get Engines
            const ql = kernel.context?.getService('objectql');

            if (service === 'data') {
                // Delegate to protocol service when available for proper expand/populate support
                const protocol = kernel.context?.getService('protocol');
                // All data responses conform to protocol.zod.ts schemas:
                // CreateDataResponse = { object, id, record }
                // GetDataResponse = { object, id, record }
                // FindDataResponse = { object, records, total?, hasMore? }
                // UpdateDataResponse = { object, id, record }
                // DeleteDataResponse = { object, id, deleted }
                if (method === 'create') {
                    const res = await ql.insert(params.object, params.data);
                    const record = { ...params.data, ...res };
                    return { object: params.object, id: record.id, record };
                }
                if (method === 'get') {
                    // Delegate to protocol for proper expand/select support
                    if (protocol) {
                        return await protocol.getData({ object: params.object, id: params.id, expand: params.expand, select: params.select });
                    }
                    let all = await ql.find(params.object);
                    if (!all) all = [];
                    const match = all.find((i: any) => i.id === params.id);
                    return match ? { object: params.object, id: params.id, record: match } : null;
                }
                if (method === 'update') {
                    if (params.id) {
                        let all = await ql.find(params.object);

                        if (all && (all as any).value) all = (all as any).value;
                        if (!all) all = [];

                        const existing = all.find((i: any) => i.id === params.id);

                        if (!existing) {
                            console.warn(`[BrokerShim] Update failed: Record ${params.id} not found.`);
                            throw new Error('[ObjectStack] Not Found');
                        }

                        try {
                            await ql.update(params.object, params.data, { where: { id: params.id } });
                        } catch (err: any) {
                            console.warn(`[BrokerShim] update failed: ${err.message}`);
                            throw err;
                        }

                        return { object: params.object, id: params.id, record: { ...existing, ...params.data } };
                    }
                    return null;
                }
                if (method === 'delete') {
                    try {
                        await ql.delete(params.object, { where: { id: params.id } });
                        return { object: params.object, id: params.id, deleted: true };
                    } catch (err: any) {
                        console.warn(`[BrokerShim] delete failed: ${err.message}`);
                        throw err;
                    }
                }
                if (method === 'find' || method === 'query') {
                    // Delegate to protocol for proper expand/populate support
                    if (protocol) {
                        return await protocol.findData({ object: params.object, query: params.query || params.filters });
                    }
                    let all = await ql.find(params.object);

                    // Handle PaginatedResult { value: [...] } vs Array [...]
                    if (!Array.isArray(all) && all && (all as any).value) {
                        all = (all as any).value;
                    }

                    if (!all) all = [];

                    const filters = params.query || params.filters;
                    let queryOptions: any = {};
                    if (filters && typeof filters === 'object') {
                        const reserved = ['top', 'skip', 'sort', 'select', 'expand', 'count', 'search'];
                        reserved.forEach(opt => {
                            if (filters[opt] !== undefined) {
                                queryOptions[opt] = filters[opt];
                            }
                        });
                    }

                    if (filters && typeof filters === 'object' && !Array.isArray(filters)) {
                        const reserved = ['top', 'skip', 'sort', 'select', 'expand', 'count', 'search'];
                        const keys = Object.keys(filters).filter(k => !reserved.includes(k));

                        if (keys.length > 0) {
                            all = all.filter((item: any) => {
                                return keys.every(k => {
                                    return String(item[k]) == String(filters[k]);
                                });
                            });
                        }
                    }

                    // --- Sort ---
                    if (queryOptions.sort) {
                        const sortFields = String(queryOptions.sort).split(',').map(s => s.trim());
                        all.sort((a: any, b: any) => {
                            for (const field of sortFields) {
                                const desc = field.startsWith('-');
                                const key = desc ? field.substring(1) : field;
                                if (a[key] < b[key]) return desc ? 1 : -1;
                                if (a[key] > b[key]) return desc ? -1 : 1;
                            }
                            return 0;
                        });
                    }

                    // --- Select ---
                    if (queryOptions.select) {
                        const selectFields = Array.isArray(queryOptions.select)
                            ? queryOptions.select
                            : String(queryOptions.select).split(',').map((s: string) => s.trim());

                        all = all.map((item: any) => {
                            const projected: any = { id: item.id }; // Always include ID
                            selectFields.forEach((f: string) => {
                                if (item[f] !== undefined) projected[f] = item[f];
                            });
                            return projected;
                        });
                    }

                    // --- Skip/Top ---
                    const totalCount = all.length;
                    const skip = parseInt(queryOptions.skip) || 0;
                    const top = parseInt(queryOptions.top);

                    if (skip > 0) {
                        all = all.slice(skip);
                    }
                    if (!isNaN(top)) {
                        all = all.slice(0, top);
                    }

                    return { object: params.object, records: all, total: totalCount };
                }
            }

            if (service === 'metadata') {
                if (method === 'types') {
                    return { types: SchemaRegistry.getRegisteredTypes() };
                }
                if (method === 'objects') {
                    const packageId = params.packageId;
                    let objs = (ql && typeof ql.getObjects === 'function') ? ql.getObjects() : [];

                    if (!objs || objs.length === 0) {
                        objs = SchemaRegistry.getAllObjects(packageId);
                    } else if (packageId) {
                        objs = objs.filter((o: any) => o._packageId === packageId);
                    }
                    return { type: 'object', items: objs };
                }
                if (method === 'getObject' || method === 'getItem') {
                    if (!params.objectName && !params.name) {
                        return SchemaRegistry.getAllObjects();
                    }

                    const name = params.objectName || params.name;

                    let def = SchemaRegistry.getObject(name);

                    if (!def && ql && typeof (ql as any).getObject === 'function') {
                        def = (ql as any).getObject(name);
                    }
                    return def || null;
                }
                // Generic metadata type: metadata.<type> → SchemaRegistry.listItems(type, packageId?)
                const packageId = params.packageId;
                const items = SchemaRegistry.listItems(method, packageId);
                if (items && items.length > 0) {
                    return { type: method, items };
                }
                return { type: method, items: [] };
            }

            // Package Management Actions
            if (service === 'package') {
                if (method === 'list') {
                    let packages = SchemaRegistry.getAllPackages();
                    if (params.status) {
                        packages = packages.filter((p: any) => p.status === params.status);
                    }
                    if (params.type) {
                        packages = packages.filter((p: any) => p.manifest?.type === params.type);
                    }
                    if (params.enabled !== undefined) {
                        packages = packages.filter((p: any) => p.enabled === params.enabled);
                    }
                    return { packages, total: packages.length };
                }
                if (method === 'get') {
                    const pkg = SchemaRegistry.getPackage(params.id);
                    if (!pkg) throw new Error(`Package not found: ${params.id}`);
                    return { package: pkg };
                }
                if (method === 'install') {
                    const manifest = params.manifest;
                    const id = manifest?.id || manifest?.name;

                    if (ql && typeof (ql as any).registerApp === 'function') {
                        (ql as any).registerApp(manifest);
                    } else {
                        SchemaRegistry.installPackage(manifest, params.settings);
                    }

                    const pkg = id ? SchemaRegistry.getPackage(id) : null;
                    return { package: pkg, message: `Package ${id || 'unknown'} installed successfully` };
                }
                if (method === 'uninstall') {
                    const success = SchemaRegistry.uninstallPackage(params.id);
                    return { id: params.id, success, message: success ? 'Uninstalled' : 'Not found' };
                }
                if (method === 'enable') {
                    const pkg = SchemaRegistry.enablePackage(params.id);
                    if (!pkg) throw new Error(`Package not found: ${params.id}`);
                    return { package: pkg, message: `Package ${params.id} enabled` };
                }
                if (method === 'disable') {
                    const pkg = SchemaRegistry.disablePackage(params.id);
                    if (!pkg) throw new Error(`Package not found: ${params.id}`);
                    return { package: pkg, message: `Package ${params.id} disabled` };
                }
            }

            console.warn(`[BrokerShim] Action not implemented: ${action}`);
            return null;
        }
    };
}
