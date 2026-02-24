// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin, SchemaRegistry } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { MSWPlugin } from '@objectstack/plugin-msw';

export interface KernelOptions {
    appConfigs?: any[];      // Multiple app configs
    appConfig?: any;         // Legacy single app config (backward compat)
    enableBrowser?: boolean; // Default true (for browser usage), set false for tests
}

export async function createKernel(options: KernelOptions) {
    const { enableBrowser = true } = options;
    
    // Support both single and multi-app modes
    const allConfigs = options.appConfigs 
        || (options.appConfig ? [options.appConfig] : []);

    console.log('[KernelFactory] Creating ObjectStack Kernel...');
    console.log('[KernelFactory] App Configs:', allConfigs.length);

    const driver = new InMemoryDriver();
    const kernel = new ObjectKernel();

    // Register ObjectQL engine
    await kernel.use(new ObjectQLPlugin());
    
    // Register the driver
    await kernel.use(new DriverPlugin(driver, 'memory'));
    
    // Load all app configs as plugins (handles object registration & seeding)
    for (const appConfig of allConfigs) {
        console.log('[KernelFactory] Loading app:', appConfig.manifest?.id || appConfig.name || 'unknown');
        await kernel.use(new AppPlugin(appConfig));
    }

    // Protocol service is registered automatically by ObjectQLPlugin.init()
    // via ObjectStackProtocolImplementation (which uses SchemaRegistry internally).
    // Do NOT manually set 'protocol' on kernel.services — it would conflict with
    // ObjectQLPlugin's ctx.registerService('protocol', ...) during bootstrap.
    console.log('[KernelFactory] Protocol service will be registered by ObjectQLPlugin');

    // --- BROKER SHIM (MUST be registered BEFORE MSWPlugin) ---
    // HttpDispatcher requires a broker to function. We inject a shim.
    (kernel as any).broker = {
        call: async (action: string, params: any, _opts: any) => {
            const parts = action.split('.');
            const service = parts[0];
            const method = parts[1];
            
            // Get Engines
            const ql = (kernel as any).context?.getService('objectql');
            
            if (service === 'data') {
                // All data responses conform to protocol.zod.ts schemas:
                // CreateDataResponse = { object, id, record }
                // GetDataResponse = { object, id, record }
                // FindDataResponse = { object, records, total?, hasMore? }
                // UpdateDataResponse = { object, id, record }
                // DeleteDataResponse = { object, id, deleted }
                if (method === 'create') {
                     const res = await ql.insert(params.object, params.data);
                     const record = { ...params.data, ...res };
                     return { object: params.object, id: record.id || record._id, record };
                }
                if (method === 'get') {
                     let all = await ql.find(params.object);
                     if (!all) all = [];
                     const match = all.find((i: any) => i.id === params.id || i._id === params.id);
                     return match ? { object: params.object, id: params.id, record: match } : null;
                }
                if (method === 'update') {
                     if (params.id) {
                         // Robust check: Manually find the record in memory since ql.find(obj, id) might not be supported by this specific mock driver setup
                         let all = await ql.find(params.object);
                         
                         if (all && (all as any).value) all = (all as any).value;
                         if (!all) all = [];
                         
                         const existing = all.find((i: any) => i.id === params.id || i._id === params.id);
                         
                         if (!existing) {
                             console.warn(`[BrokerShim] Update failed: Record ${params.id} not found.`);
                             throw new Error('[ObjectStack] Not Found'); 
                         }
                         
                         // Perform update using the ObjectQL Engine signature: update(object, data, options)
                         // where options.filter can be the ID string
                         try {
                              await ql.update(params.object, params.data, { filter: params.id });
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
                        // ql.delete(object, options) where options.filter is ID
                        await ql.delete(params.object, { filter: params.id });
                        return { object: params.object, id: params.id, deleted: true };
                    } catch (err: any) {
                        console.warn(`[BrokerShim] delete failed: ${err.message}`);
                        throw err;
                    }
                }
                if (method === 'find' || method === 'query') {
                    let all = await ql.find(params.object);
                    
                    // DEBUG SHIM 
                    // console.log(`[BrokerShim debug] Incoming Params:`, JSON.stringify(params, null, 2));
                    // console.log(`[BrokerShim debug] Raw ql.find result type: ${typeof all}, isArray: ${Array.isArray(all)}, value:`, all);
                    
                    // Handle PaginatedResult { value: [...] } vs Array [...]
                    if (!Array.isArray(all) && all && (all as any).value) {
                         console.log('[BrokerShim debug] Detected PaginatedResult wrapper, unwrapping .value');
                         all = (all as any).value;
                    }
                    
                    if (!all) all = [];

                    const filters = params.query || params.filters;
                    // Extract standard query options possibly passed via filters (due to MSW plugin mapping)
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
                         // Filter out reserved query parameters that are NOT field names
                         const reserved = ['top', 'skip', 'sort', 'select', 'expand', 'count', 'search'];
                         const keys = Object.keys(filters).filter(k => !reserved.includes(k));

                         if (keys.length > 0) {
                              // console.log('[BrokerShim debug] Applying filters:', keys);
                              all = all.filter((item: any) => {
                                  return keys.every(k => {
                                      // Loose equality check
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
                            const projected: any = { id: item.id, _id: item._id }; // Always include ID
                            selectFields.forEach((f: string) => {
                                if (item[f] !== undefined) projected[f] = item[f];
                            });
                            return projected;
                        });
                    }

                    // --- Skip/Top ---
                    const totalCount = all.length; // Capture total BEFORE pagination
                    const skip = parseInt(queryOptions.skip) || 0;
                    const top = parseInt(queryOptions.top); // undefined is fine

                    if (skip > 0) {
                        all = all.slice(skip);
                    }
                    if (!isNaN(top)) {
                        all = all.slice(0, top);
                    }
                    
                    console.log(`[BrokerShim] find/query(${params.object}) -> count: ${all.length}, total: ${totalCount}`);
                    // Spec: FindDataResponse = { object, records, total?, hasMore? }
                    return { object: params.object, records: all, total: totalCount };
                }
            }
            
            if (service === 'metadata') {
                if (method === 'types') {
                    // Return all registered metadata types
                    return { types: SchemaRegistry.getRegisteredTypes() };
                }
                if (method === 'objects') {
                    // Return spec-compliant GetMetaItemsResponse
                    // Support optional packageId filter
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
                     // Hack: If no objectName provided, it might be a list request mapped incorrectly
                     // or a request for the "object" type definition itself?
                     // For 'object', we usually want the list if no name.
                     if (!params.objectName && !params.name) {
                         return SchemaRegistry.getAllObjects();
                     }

                     const name = params.objectName || params.name;

                     // Check registry first (synchronous cache)
                     let def = SchemaRegistry.getObject(name);
                     
                     // If not found, try engine (might be dynamic)
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
            // Protocol: ListPackagesResponse, GetPackageResponse, InstallPackageResponse, etc.
            if (service === 'package') {
                if (method === 'list') {
                    let packages = SchemaRegistry.getAllPackages();
                    // Apply optional filters
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
    // --- BROKER SHIM END ---

    // MSW Plugin (AFTER protocol service and broker shim are registered)
    await kernel.use(new MSWPlugin({
        enableBrowser: enableBrowser,
        baseUrl: '/api/v1',
        logRequests: true
    }));
    
    await kernel.bootstrap();

    // FORCE SYNC SEED: Guarantees data availability for both Browser and Tests
    const ql = (kernel as any).context?.getService('objectql');
    if (ql) {
        // Helper: resolve short object name to FQN using namespace
        const RESERVED_NS = new Set(['base', 'system']);
        const toFQN = (name: string, namespace?: string) => {
            if (name.includes('__') || !namespace || RESERVED_NS.has(namespace)) return name;
            return `${namespace}__${name}`;
        };

        // Seed data for all app configs
        for (const appConfig of allConfigs) {
            const namespace = (appConfig.manifest || appConfig)?.namespace as string | undefined;
            
            // Collect datasets from all locations:
            // 1. Top-level `data` (new standard)
            // 2. `manifest.data` (legacy/backward compat)
            const seedDatasets: any[] = [];
            if (Array.isArray(appConfig.data)) {
                seedDatasets.push(...appConfig.data);
            }
            if (appConfig.manifest && Array.isArray(appConfig.manifest.data)) {
                seedDatasets.push(...appConfig.manifest.data);
            }
            
            for (const dataset of seedDatasets) {
                if (!dataset.records || !dataset.object) continue;
                
                const objectFQN = toFQN(dataset.object, namespace);
                
                // Check if data already seeded
                let existing = await ql.find(objectFQN);
                if (existing && (existing as any).value) existing = (existing as any).value;
                
                if (!existing || existing.length === 0) {
                    console.log(`[KernelFactory] Manual Seeding ${dataset.records.length} records for ${objectFQN}`);
                    for (const record of dataset.records) {
                        await ql.insert(objectFQN, record);
                    }
                } else {
                    console.log(`[KernelFactory] Data verified present for ${objectFQN}: ${existing.length} records.`);
                }
            }
        }
    }

    return kernel;
}
