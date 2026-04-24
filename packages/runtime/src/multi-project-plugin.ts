// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MultiProjectPlugin
 *
 * Packages the multi-kernel orchestration pieces (ADR-0003/0004) as a
 * single kernel plugin. When mounted on the control-plane kernel it
 * registers three services that the HTTP dispatcher, cloud handlers and
 * provisioning flows expect to find:
 *
 *   - `env-registry`    — `EnvironmentDriverRegistry` for hostname / id
 *                          → project driver resolution with LRU caching.
 *   - `kernel-manager`  — `KernelManager` LRU of per-project
 *                          `ObjectKernel` instances, built on demand by
 *                          `DefaultProjectKernelFactory`.
 *   - `template-seeder` — seeds a newly-provisioned project with
 *                          metadata + rows from a caller-supplied
 *                          template registry.
 *
 * Consumers (HttpDispatcher, createHonoApp) pick these up from the
 * kernel's service registry, so nothing needs to be threaded through
 * constructor arguments from the host app.
 */

import type { Contracts } from '@objectstack/spec';
import { Plugin, PluginContext } from '@objectstack/core';
import { SeedLoaderConfigSchema } from '@objectstack/spec/data';
import {
    DefaultEnvironmentDriverRegistry,
    type EnvironmentDriverRegistry,
    type SecretEncryptor,
} from './environment-registry.js';
import {
    DefaultProjectKernelFactory,
    type BasePluginsFactory,
    type AppBundleResolver,
} from './project-kernel-factory.js';
import { KernelManager } from './kernel-manager.js';
import { SeedLoaderService } from './seed-loader.js';

type IDataDriver = Contracts.IDataDriver;

/**
 * Lazy descriptor for a project template. `load()` returns an
 * `ObjectStackDefinition`-shaped bundle (`.objects`, `.views`, …,
 * optional `.data`) that the seeder fans out into `bulkRegister`
 * and optional row seeding.
 */
export interface ProjectTemplate {
    id: string;
    label: string;
    description: string;
    category?: string;
    load(): Promise<any>;
}

export interface TemplateSeeder {
    listTemplates(): Array<Pick<ProjectTemplate, 'id' | 'label' | 'description' | 'category'>>;
    seed(params: { projectId: string; templateId: string }): Promise<void>;
}

export interface MultiProjectPluginConfig {
    /** Shared control-plane driver (sqlite/turso/…). Also registered via DriverPlugin elsewhere in the stack. */
    controlDriver: IDataDriver;
    /** Per-project base plugins (ObjectQL + Metadata + anything else shared across every project kernel). */
    basePlugins: BasePluginsFactory;
    /** Optional resolver for subscribed App bundles. */
    appBundles?: AppBundleResolver;
    /** Optional template registry for provisioning-time metadata seeding. */
    templates?: Record<string, ProjectTemplate>;
    /** Override the default no-op secret encryptor. */
    encryptor?: SecretEncryptor;
    /** EnvironmentDriverRegistry cache TTL (ms). */
    cacheTTLMs?: number;
    /** KernelManager LRU size. */
    maxSize?: number;
    /** KernelManager idle TTL (ms). */
    ttlMs?: number;
}

interface ExtractedItem {
    type: string;
    name: string;
    data: unknown;
}

const RESERVED_NS = new Set(['base', 'system']);

/**
 * Flatten an `ObjectStackDefinition` bundle into `{type, name, data}`
 * items consumable by `MetadataPlugin.bulkRegister`. Object names are
 * namespaced (`${ns}__${name}`) when the bundle declares a non-reserved
 * namespace and the name is not already prefixed.
 */
function extractMetadataItems(bundle: any): ExtractedItem[] {
    const items: ExtractedItem[] = [];
    const ns = bundle?.manifest?.namespace as string | undefined;

    const toFQN = (name: string): string =>
        name.includes('__') || !ns || RESERVED_NS.has(ns) ? name : `${ns}__${name}`;

    const pushAll = (type: string, arr?: any[], rewriteName = false) => {
        for (const item of arr ?? []) {
            if (!item?.name) continue;
            const name = rewriteName ? toFQN(item.name) : item.name;
            const data = rewriteName ? { ...item, name } : item;
            items.push({ type, name, data });
        }
    };

    pushAll('object', bundle?.objects, true);
    pushAll('view', bundle?.views);
    pushAll('dashboard', bundle?.dashboards);
    pushAll('report', bundle?.reports);
    pushAll('flow', bundle?.flows);
    pushAll('agent', bundle?.agents);
    pushAll('app', bundle?.apps);
    pushAll('action', bundle?.actions);

    return items;
}

/**
 * Rewrite a dataset's `object` to the namespaced FQN so seed rows target
 * the object the metadata layer actually registered. Bundle authors write
 * the short name (`task`) because the namespace lives on the manifest;
 * `extractMetadataItems` does the equivalent rewrite for objects.
 */
function namespaceDatasets(bundle: any): any[] {
    const ns = bundle?.manifest?.namespace as string | undefined;
    const datasets = Array.isArray(bundle?.data) ? bundle.data : [];
    if (!ns || RESERVED_NS.has(ns)) return datasets;
    return datasets.map((ds: any) => {
        if (!ds?.object || ds.object.includes('__')) return ds;
        return { ...ds, object: `${ns}__${ds.object}` };
    });
}

function createTemplateSeeder(
    kernelManager: KernelManager,
    templates: Record<string, ProjectTemplate>,
): TemplateSeeder {
    return {
        listTemplates() {
            return Object.values(templates).map(({ id, label, description, category }) => ({
                id,
                label,
                description,
                category,
            }));
        },

        async seed({ projectId, templateId }) {
            const template = templates[templateId];
            if (!template) {
                throw new Error(
                    `Unknown template: '${templateId}'. Available: [${Object.keys(templates).join(', ')}]`,
                );
            }

            const bundle = await template.load();
            const items = bundle ? extractMetadataItems(bundle) : [];
            const dataSets = bundle ? namespaceDatasets(bundle) : [];

            // Empty bundle (e.g. the "blank" template) → nothing to seed.
            if (items.length === 0 && dataSets.length === 0) return;

            const kernel = await kernelManager.getOrCreate(projectId);

            let metadata: any;
            try {
                metadata = await kernel.getServiceAsync('metadata');
            } catch (err: any) {
                throw new Error(
                    `metadata service unavailable for project ${projectId}: ${err?.message ?? err}`,
                );
            }
            if (!metadata || typeof metadata.bulkRegister !== 'function') {
                throw new Error(
                    `metadata.bulkRegister unavailable for project ${projectId} (got ${metadata ? typeof metadata : 'null'})`,
                );
            }

            const engine: any = await kernel.getServiceAsync('objectql').catch(() => null);
            if (!engine) {
                throw new Error(
                    `objectql engine unavailable for project ${projectId} — metadata persistence would be in-memory only`,
                );
            }
            if (typeof metadata.setDataEngine === 'function') {
                try { metadata.setDataEngine(engine, undefined, projectId); } catch { /* already set */ }
            }

            if (items.length > 0) {
                const result: any = await metadata.bulkRegister(items, { continueOnError: true });
                const failed = result?.failed ?? 0;
                if (failed > 0) {
                    const errs = (result?.errors ?? [])
                        .slice(0, 5)
                        .map((e: any) => `${e?.type}/${e?.name}: ${e?.error ?? 'unknown'}`)
                        .join('; ');
                    throw new Error(
                        `bulkRegister reported ${failed} failures for project ${projectId}: ${errs}`,
                    );
                }
            }

            // Register the bundle into the ObjectQL engine's SchemaRegistry so that
            // syncSchemas() can create tables for the newly-registered objects.
            // bulkRegister() only updates MetadataManager's registry, not the engine's
            // internal _registry — without this, syncSchemas() has no objects to create.
            if (items.length > 0 && typeof engine?.registerApp === 'function') {
                try { (engine as any).registerApp(bundle); } catch { /* best effort */ }
            }

            // Sync schemas so tables exist before seeding.
            if (items.length > 0 && typeof engine?.syncSchemas === 'function') {
                try { await engine.syncSchemas(); } catch { /* best effort */ }
            }

            if (dataSets.length > 0) {
                const seedLoader = new SeedLoaderService(engine, metadata, console as any);
                const config = SeedLoaderConfigSchema.parse({});
                await seedLoader.load({ datasets: dataSets, config });
            }

            // Force a persistence flush so the per-project JSON file is
            // written before the provisioning handler returns; otherwise
            // the memory driver's dirty flag only saves on a 2s timer and
            // early HTTP responses may see an empty file on disk.
            const driverWithFlush = (kernel as any).services?.driver ?? (kernel as any).getService?.('driver');
            const flushable = typeof driverWithFlush?.flush === 'function'
                ? driverWithFlush
                : null;
            if (flushable) {
                try { await flushable.flush(); } catch { /* best effort */ }
            }
        },
    };
}

/**
 * Control-plane plugin that stands up the per-project orchestration
 * layer. Registers `env-registry`, `kernel-manager` and
 * `template-seeder` on the control kernel.
 */
export class MultiProjectPlugin implements Plugin {
    readonly name = 'com.objectstack.runtime.multi-project';
    readonly version = '1.0.0';

    private readonly config: MultiProjectPluginConfig;
    private kernelManager?: KernelManager;

    constructor(config: MultiProjectPluginConfig) {
        this.config = config;
    }

    init = async (ctx: PluginContext): Promise<void> => {
        const envRegistry: EnvironmentDriverRegistry = new DefaultEnvironmentDriverRegistry({
            controlPlaneDriver: this.config.controlDriver,
            encryptor: this.config.encryptor,
            cacheTTLMs: this.config.cacheTTLMs,
        });

        const factory = new DefaultProjectKernelFactory({
            controlPlaneDriver: this.config.controlDriver,
            basePlugins: this.config.basePlugins,
            appBundles: this.config.appBundles,
            envRegistry,
            encryptor: this.config.encryptor,
        });

        const kernelManager = new KernelManager({
            factory,
            maxSize: this.config.maxSize,
            ttlMs: this.config.ttlMs,
        });
        this.kernelManager = kernelManager;

        const seeder = createTemplateSeeder(kernelManager, this.config.templates ?? {});

        ctx.registerService('env-registry', envRegistry);
        ctx.registerService('kernel-manager', kernelManager);
        ctx.registerService('template-seeder', seeder);

        ctx.logger.info?.('MultiProjectPlugin: registered env-registry + kernel-manager + template-seeder');
    };

    destroy = async (): Promise<void> => {
        try { await this.kernelManager?.evictAll(); } catch { /* best effort */ }
    };
}
