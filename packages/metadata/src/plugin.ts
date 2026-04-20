// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext } from '@objectstack/core';
import { NodeMetadataManager } from './node-metadata-manager.js';
import { DEFAULT_METADATA_TYPE_REGISTRY } from '@objectstack/spec/kernel';
import type { MetadataPluginConfig } from '@objectstack/spec/kernel';
import { SysMetadataObject } from './objects/sys-metadata.object.js';
import { SysMetadataHistoryObject } from './objects/sys-metadata-history.object.js';
import { SystemObjects } from '@objectstack/objectos';

export interface MetadataPluginOptions {
    rootDir?: string;
    watch?: boolean;
    config?: Partial<MetadataPluginConfig>;
    /** Organization ID for multi-tenant metadata isolation (passed to DatabaseLoader). */
    organizationId?: string;
    /** Environment ID — undefined = platform-global, set = env-scoped metadata. */
    environmentId?: string;
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
            const manifestService = ctx.getService<{ register(m: any): void }>('manifest');

            // Register the metadata envelope tables
            manifestService.register({
                id: 'com.objectstack.metadata',
                name: 'Metadata',
                version: '1.0.0',
                type: 'plugin',
                scope: 'platform',
                namespace: 'sys',
                objects: [SysMetadataObject, SysMetadataHistoryObject],
            });

            // Register the queryable system objects from @objectstack/objectos
            manifestService.register({
                id: 'com.objectstack.objectos',
                name: 'ObjectOS System Objects',
                version: '1.0.0',
                type: 'plugin',
                scope: 'platform',
                namespace: 'sys',
                objects: Object.values(SystemObjects),
            });

            ctx.logger.info('Registered system metadata objects', {
                metadata: ['sys_metadata', 'sys_metadata_history'],
                objectos: Object.keys(SystemObjects),
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
                    recursive: true,
                    patterns: entry.filePatterns,
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

        // Bridge ObjectQL data engine to MetadataManager.
        // The engine handles datasource routing automatically via namespace mapping
        // (e.g. namespace:'sys' → turso driver). No manual driver resolution needed.
        try {
            const ql = ctx.getService<any>('objectql');
            if (ql) {
                ctx.logger.info('[MetadataPlugin] Bridging ObjectQL engine to MetadataManager');
                this.manager.setDataEngine(ql, this.options.organizationId, this.options.environmentId);
            }
        } catch {
            ctx.logger.debug('[MetadataPlugin] ObjectQL not available — database persistence disabled');
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
