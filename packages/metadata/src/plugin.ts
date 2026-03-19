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

        // Register Metadata Manager as primary metadata service provider
        // This takes precedence over ObjectQL's fallback metadata service
        ctx.registerService('metadata', this.manager);

        // Register metadata system objects so ObjectQLPlugin auto-discovers them
        ctx.registerService('app.com.objectstack.metadata', {
            id: 'com.objectstack.metadata',
            name: 'Metadata',
            version: '1.0.0',
            type: 'plugin',
            namespace: 'sys',
            objects: [SysMetadataObject],
        });

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
    }
}
