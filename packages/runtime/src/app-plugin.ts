// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext } from '@objectstack/core';
import { SeedLoaderService } from './seed-loader.js';
import type { IMetadataService } from '@objectstack/spec/contracts';

/**
 * AppPlugin
 * 
 * Adapts a generic App Bundle (Manifest + Runtime Code) into a Kernel Plugin.
 * 
 * Responsibilities:
 * 1. Register App Manifest as a service (for ObjectQL discovery)
 * 2. Execute Runtime `onEnable` hook (for code logic)
 */
export class AppPlugin implements Plugin {
    name: string;
    type = 'app';
    version?: string;
    
    private bundle: any;

    constructor(bundle: any) {
        this.bundle = bundle;
        // Support both direct manifest (legacy) and Stack Definition (nested manifest)
        const sys = bundle.manifest || bundle;
        const appId = sys.id || sys.name || 'unnamed-app';
        
        this.name = `plugin.app.${appId}`;
        this.version = sys.version;
    }

    init = async (ctx: PluginContext) => {
        const sys = this.bundle.manifest || this.bundle;
        const appId = sys.id || sys.name;

        ctx.logger.info('Registering App Service', { 
            appId, 
            pluginName: this.name,
            version: this.version 
        });
        
        // Register the app manifest as a service
        // ObjectQLPlugin will discover this and call ql.registerApp()
        const serviceName = `app.${appId}`;

        // Merge manifest with the bundle to ensure objects/apps are accessible at root
        // This supports both Legacy Manifests and new Stack Definitions
        const servicePayload = this.bundle.manifest 
            ? { ...this.bundle.manifest, ...this.bundle }
            : this.bundle;

        ctx.registerService(serviceName, servicePayload);
    }

    start = async (ctx: PluginContext) => {
        const sys = this.bundle.manifest || this.bundle;
        const appId = sys.id || sys.name;
        
        // Execute Runtime Step
        // Retrieve ObjectQL engine from services
        // We cast to any/ObjectQL because ctx.getService returns unknown
        const ql = ctx.getService('objectql') as any;
        
        if (!ql) {
            ctx.logger.warn('ObjectQL engine service not found', { 
                appName: this.name,
                appId 
            });
            return;
        }

        ctx.logger.debug('Retrieved ObjectQL engine service', { appId });

        const runtime = this.bundle.default || this.bundle;
        
        if (runtime && typeof runtime.onEnable === 'function') {
             ctx.logger.info('Executing runtime.onEnable', { 
                 appName: this.name,
                 appId 
             });
             
             // Construct the Host Context (mirroring old ObjectQL.use logic)
             const hostContext = {
                ...ctx,
                ql,
                logger: ctx.logger,
                drivers: {
                    register: (driver: any) => {
                        ctx.logger.debug('Registering driver via app runtime', { 
                            driverName: driver.name,
                            appId 
                        });
                        ql.registerDriver(driver);
                    }
                },
             };
             
             await runtime.onEnable(hostContext);
             ctx.logger.debug('Runtime.onEnable completed', { appId });
        } else {
             ctx.logger.debug('No runtime.onEnable function found', { appId });
        }

        // Data Seeding
        // Collect seed data from multiple locations (top-level `data` preferred, `manifest.data` for backward compat)
        const seedDatasets: any[] = [];
        
        // 1. Top-level `data` field (new standard location on ObjectStackDefinition)
        if (Array.isArray(this.bundle.data)) {
            seedDatasets.push(...this.bundle.data);
        }
        
        // 2. Legacy: `manifest.data` (backward compatibility)
        const manifest = this.bundle.manifest || this.bundle;
        if (manifest && Array.isArray(manifest.data)) {
            seedDatasets.push(...manifest.data);
        }

        // Resolve short object names to FQN using the package's namespace.
        // e.g., seed `object: 'task'` in namespace 'todo' → 'todo__task'
        // Reserved namespaces ('base', 'system') are not prefixed.
        const namespace = (this.bundle.manifest || this.bundle)?.namespace as string | undefined;
        const RESERVED_NS = new Set(['base', 'system']);
        const toFQN = (name: string) => {
            if (name.includes('__') || !namespace || RESERVED_NS.has(namespace)) return name;
            return `${namespace}__${name}`;
        };
        
        if (seedDatasets.length > 0) {
             ctx.logger.info(`[AppPlugin] Found ${seedDatasets.length} seed datasets for ${appId}`);

             // Normalize dataset object names to FQN
             const normalizedDatasets = seedDatasets
                 .filter((d: any) => d.object && Array.isArray(d.records))
                 .map((d: any) => ({
                     ...d,
                     object: toFQN(d.object),
                 }));

             // Use SeedLoaderService for metadata-driven loading with reference resolution
             try {
                 const metadata = ctx.getService('metadata') as IMetadataService | undefined;
                 if (metadata) {
                     const seedLoader = new SeedLoaderService(ql, metadata, ctx.logger);
                     const { SeedLoaderRequestSchema } = await import('@objectstack/spec/data');
                     const request = SeedLoaderRequestSchema.parse({
                         datasets: normalizedDatasets,
                         config: { defaultMode: 'upsert', multiPass: true },
                     });
                     const result = await seedLoader.load(request);
                     ctx.logger.info('[Seeder] Seed loading complete', {
                         inserted: result.summary.totalInserted,
                         updated: result.summary.totalUpdated,
                         errors: result.errors.length,
                     });
                 } else {
                     // Fallback: basic insert when metadata service is not available
                     ctx.logger.debug('[Seeder] No metadata service; using basic insert fallback');
                     for (const dataset of normalizedDatasets) {
                         ctx.logger.info(`[Seeder] Seeding ${dataset.records.length} records for ${dataset.object}`);
                         for (const record of dataset.records) {
                             try {
                                 await ql.insert(dataset.object, record);
                             } catch (err: any) {
                                 ctx.logger.warn(`[Seeder] Failed to insert ${dataset.object} record:`, { error: err.message });
                             }
                         }
                     }
                     ctx.logger.info('[Seeder] Data seeding complete.');
                 }
             } catch (err: any) {
                 // If SeedLoaderService fails (e.g., metadata not available), fall back to basic insert
                 ctx.logger.warn('[Seeder] SeedLoaderService failed, falling back to basic insert', { error: err.message });
                 for (const dataset of normalizedDatasets) {
                     for (const record of dataset.records) {
                         try {
                             await ql.insert(dataset.object, record);
                         } catch (insertErr: any) {
                             ctx.logger.warn(`[Seeder] Failed to insert ${dataset.object} record:`, { error: insertErr.message });
                         }
                     }
                 }
                 ctx.logger.info('[Seeder] Data seeding complete (fallback).');
             }
        }
    }
}
