// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext } from '@objectstack/core';
import { SeedLoaderService } from './seed-loader.js';
import type { IMetadataService, II18nService } from '@objectstack/spec/contracts';

/**
 * AppPlugin
 * 
 * Adapts a generic App Bundle (Manifest + Runtime Code) into a Kernel Plugin.
 * 
 * Responsibilities:
 * 1. Register App Manifest as a service (for ObjectQL discovery)
 * 2. Execute Runtime `onEnable` hook (for code logic)
 * 3. Auto-load i18n translation bundles into the kernel's i18n service
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
        
        // Register the app manifest directly via the manifest service.
        // This immediately decomposes the manifest into SchemaRegistry entries.
        const servicePayload = this.bundle.manifest
            ? { ...this.bundle.manifest, ...this.bundle }
            : this.bundle;

        ctx.getService<{ register(m: any): void }>('manifest').register(servicePayload);
    }

    start = async (ctx: PluginContext) => {
        const sys = this.bundle.manifest || this.bundle;
        const appId = sys.id || sys.name;
        
        // Execute Runtime Step
        // Retrieve ObjectQL engine from services
        // ctx.getService throws when a service is not registered, so we
        // must use try/catch instead of a null-check.
        let ql: any;
        try {
            ql = ctx.getService('objectql');
        } catch {
            // Service not registered — handled below
        }

        if (!ql) {
            ctx.logger.warn('ObjectQL engine service not found', { 
                appName: this.name,
                appId 
            });
            return;
        }

        ctx.logger.debug('Retrieved ObjectQL engine service', { appId });

        // Configure datasourceMapping if provided in the stack definition
        if (this.bundle.datasourceMapping && Array.isArray(this.bundle.datasourceMapping)) {
            ctx.logger.info('Configuring datasource mapping rules', {
                appId,
                ruleCount: this.bundle.datasourceMapping.length
            });
            ql.setDatasourceMapping(this.bundle.datasourceMapping);
        }

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

        // ── i18n Translation Loading ─────────────────────────────────────
        // Auto-load translation bundles from the app config into the
        // kernel's i18n service, so discovery and handlers stay consistent.
        this.loadTranslations(ctx, appId);

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

    /**
     * Auto-load i18n translation bundles from the app config into the
     * kernel's i18n service. Handles both `translations` (array of
     * TranslationBundle) and `i18n` config (default locale, etc.).
     *
     * Gracefully skips when the i18n service is not registered —
     * this keeps AppPlugin resilient across server/dev/mock environments.
     */
    private loadTranslations(ctx: PluginContext, appId: string): void {
        // ctx.getService throws when a service is not registered, so we
        // must use try/catch to gracefully skip when no i18n plugin is loaded.
        let i18nService: II18nService | undefined;
        try {
            i18nService = ctx.getService('i18n') as II18nService;
        } catch {
            // Service not registered — handled below
        }

        // Collect translation bundles early to determine if we have data
        const bundles: Array<Record<string, unknown>> = [];
        if (Array.isArray(this.bundle.translations)) {
            bundles.push(...this.bundle.translations);
        }
        const manifest = this.bundle.manifest || this.bundle;
        if (manifest && Array.isArray(manifest.translations) && manifest.translations !== this.bundle.translations) {
            bundles.push(...manifest.translations);
        }

        if (!i18nService) {
            if (bundles.length > 0) {
                ctx.logger.warn(
                    `[i18n] App "${appId}" has ${bundles.length} translation bundle(s) but no i18n service is registered. ` +
                    'Translations will not be served via REST API. ' +
                    'Register I18nServicePlugin from @objectstack/service-i18n, or use DevPlugin ' +
                    'which auto-detects translations and registers the i18n service automatically.'
                );
            } else {
                ctx.logger.debug('[i18n] No i18n service registered; skipping translation loading', { appId });
            }
            return;
        }

        // Apply i18n config (default locale, etc.)
        const i18nConfig = this.bundle.i18n || (this.bundle.manifest || this.bundle)?.i18n;
        if (i18nConfig?.defaultLocale && typeof i18nService.setDefaultLocale === 'function') {
            i18nService.setDefaultLocale(i18nConfig.defaultLocale);
            ctx.logger.debug('[i18n] Set default locale', { appId, locale: i18nConfig.defaultLocale });
        }

        if (bundles.length === 0) {
            return;
        }

        let loadedLocales = 0;
        for (const bundle of bundles) {
            // Each bundle is a TranslationBundle: Record<locale, TranslationData>
            for (const [locale, data] of Object.entries(bundle)) {
                if (data && typeof data === 'object') {
                    try {
                        i18nService.loadTranslations(locale, data as Record<string, unknown>);
                        loadedLocales++;
                    } catch (err: any) {
                        ctx.logger.warn('[i18n] Failed to load translations', { appId, locale, error: err.message });
                    }
                }
            }
        }

        // Emit diagnostic when the active i18n service is a fallback/stub
        const svcAny = i18nService as unknown as Record<string, unknown>;
        if (svcAny._fallback || svcAny._dev) {
            ctx.logger.info(
                `[i18n] Loaded ${loadedLocales} locale(s) into in-memory i18n fallback for "${appId}". ` +
                'For production, consider registering I18nServicePlugin from @objectstack/service-i18n.'
            );
        } else {
            ctx.logger.info('[i18n] Loaded translation bundles', { appId, bundles: bundles.length, locales: loadedLocales });
        }
    }

    /**
     * Plugin onDisable hook - cleanup when plugin is unloaded
     */
    onDisable = async (ctx: PluginContext) => {
        const sys = this.bundle.manifest || this.bundle;
        const appId = sys.id || sys.name;

        ctx.logger.info('Disabling app plugin', { appId, pluginName: this.name });

        // Call user-defined onDisable if exists
        const runtime = this.bundle.default || this.bundle;
        if (runtime && typeof runtime.onDisable === 'function') {
            try {
                const ql = ctx.getService('objectql');
                const hostContext = {
                    ...ctx,
                    ql,
                    logger: ctx.logger
                };

                await runtime.onDisable(hostContext);
                ctx.logger.debug('Runtime.onDisable completed', { appId });
            } catch (err: any) {
                ctx.logger.error('Runtime.onDisable failed', {
                    appId,
                    error: err.message
                });
            }
        }

        ctx.logger.info('App plugin disabled', { appId });
    }
}
