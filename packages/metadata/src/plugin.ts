// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext } from '@objectstack/core';
import { NodeMetadataManager } from './node-metadata-manager.js';
import { DEFAULT_METADATA_TYPE_REGISTRY } from '@objectstack/spec/kernel';
import type { MetadataPluginConfig } from '@objectstack/spec/kernel';
import { SysMetadataObject } from './objects/sys-metadata.object.js';

export interface MetadataPluginOptions {
    rootDir?: string;
    watch?: boolean;
    config?: Partial<MetadataPluginConfig>;
}

export class MetadataPlugin implements Plugin {
    name = 'com.objectstack.metadata';
    type = 'standard';
    version = '1.0.0';
    
    private manager: NodeMetadataManager;
    private options: MetadataPluginOptions;

    constructor(options: MetadataPluginOptions = {}) {
        this.options = {
            watch: true,
            ...options
        };

        const rootDir = this.options.rootDir || process.cwd();

        this.manager = new NodeMetadataManager({ 
            rootDir,
            watch: this.options.watch ?? true,
            formats: ['yaml', 'json', 'typescript', 'javascript'] 
        });

        // Initialize with default type registry
        this.manager.setTypeRegistry(DEFAULT_METADATA_TYPE_REGISTRY);
    }

    init = async (ctx: PluginContext) => {
        ctx.logger.info('Initializing Metadata Manager', {
            root: this.options.rootDir || process.cwd(),
            watch: this.options.watch
        });

        // Register Metadata Manager as the primary metadata service provider.
        ctx.registerService('metadata', this.manager);
        console.log('[MetadataPlugin] Registered metadata service, has getRegisteredTypes:', typeof this.manager.getRegisteredTypes);

        // Register metadata system objects via the manifest service (if available).
        // MetadataPlugin may init before ObjectQLPlugin, so wrap in try/catch.
        try {
            ctx.getService<{ register(m: any): void }>('manifest').register({
                id: 'com.objectstack.metadata',
                name: 'Metadata',
                version: '1.0.0',
                type: 'plugin',
                namespace: 'sys',
                objects: [SysMetadataObject],
            });
        } catch {
            // ObjectQL not loaded yet — objects will be discovered via legacy fallback
        }

        ctx.logger.info('MetadataPlugin providing metadata service (primary mode)', {
            mode: 'file-system',
            features: ['watch', 'persistence', 'multi-format', 'query', 'overlay', 'type-registry']
        });
    }

    start = async (ctx: PluginContext) => {
        ctx.logger.info('Loading metadata from file system...');
        
        // Use the type registry to discover metadata types (sorted by loadOrder)
        const sortedTypes = [...DEFAULT_METADATA_TYPE_REGISTRY]
            .sort((a, b) => a.loadOrder - b.loadOrder);

        let totalLoaded = 0;
        for (const entry of sortedTypes) {
            try {
                const items = await this.manager.loadMany(entry.type, {
                    recursive: true
                });

                if (items.length > 0) {
                    // Register loaded items in the in-memory registry
                    for (const item of items) {
                        const meta = item as any;
                        if (meta?.name) {
                            await this.manager.register(entry.type, meta.name, item);
                        }
                    }
                    ctx.logger.info(`Loaded ${items.length} ${entry.type} from file system`);
                    totalLoaded += items.length;
                }
            } catch (e: any) {
                ctx.logger.debug(`No ${entry.type} metadata found`, { error: e.message });
            }
        }
        
        ctx.logger.info('Metadata loading complete', { 
            totalItems: totalLoaded,
            registeredTypes: sortedTypes.length,
        });

        // Bridge database driver from kernel service registry to MetadataManager.
        // Uses ObjectQL engine's datasource mapping to resolve the correct driver
        // for sys_metadata (respects namespace → datasource routing).
        // Falls back to the first available driver.* service when ObjectQL is unavailable.
        let driverBridged = false;
        try {
            const ql = ctx.getService<any>('objectql');
            if (ql) {
                const tableName = this.manager['config']?.tableName ?? 'sys_metadata';
                const driver = ql.getDriverForObject?.(tableName);
                if (driver) {
                    ctx.logger.info('[MetadataPlugin] Bridging driver to MetadataManager via ObjectQL routing', {
                        tableName,
                        driver: driver.name,
                    });
                    this.manager.setDatabaseDriver(driver);
                    driverBridged = true;
                } else {
                    ctx.logger.debug('[MetadataPlugin] ObjectQL could not resolve driver for metadata table', { tableName });
                }
            }
        } catch {
            // ObjectQL not available — will fall through to driver service fallback below
        }

        // Fallback: scan for driver.* services when ObjectQL didn't provide a driver
        if (!driverBridged) {
            try {
                const services = ctx.getServices();
                for (const [serviceName, service] of services) {
                    if (serviceName.startsWith('driver.') && service) {
                        ctx.logger.info('[MetadataPlugin] Bridging driver to MetadataManager (fallback: first driver)', {
                            driverService: serviceName,
                        });
                        this.manager.setDatabaseDriver(service);
                        break;
                    }
                }
            } catch (e: any) {
                ctx.logger.debug('[MetadataPlugin] No driver service found', { error: e.message });
            }
        }

        // Bridge realtime service from kernel service registry to MetadataManager.
        // RealtimeServicePlugin registers as 'realtime' service during init().
        // This enables MetadataManager to publish metadata change events.
        try {
            const realtimeService = ctx.getService('realtime');
            if (realtimeService && typeof realtimeService === 'object' && 'publish' in realtimeService) {
                ctx.logger.info('[MetadataPlugin] Bridging realtime service to MetadataManager for event publishing');
                this.manager.setRealtimeService(realtimeService as any);
            }
        } catch (e: any) {
            ctx.logger.debug('[MetadataPlugin] No realtime service found — metadata events will not be published', {
                error: e.message,
            });
        }
    }
}
