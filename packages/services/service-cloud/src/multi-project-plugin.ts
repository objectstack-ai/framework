// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext } from '@objectstack/core';
import { SeedLoaderService } from '@objectstack/runtime';
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
import type * as Contracts from '@objectstack/spec/contracts';

type IDataDriver = Contracts.IDataDriver;

/**
 * Lazy descriptor for a project template.
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
    seedBundle(params: { projectId: string; bundle: any }): Promise<void>;
}

export interface MultiProjectPluginConfig {
    controlDriver: IDataDriver;
    basePlugins: BasePluginsFactory;
    appBundles?: AppBundleResolver;
    templates?: Record<string, ProjectTemplate>;
    encryptor?: SecretEncryptor;
    cacheTTLMs?: number;
    maxSize?: number;
    ttlMs?: number;
}

interface ExtractedItem {
    type: string;
    name: string;
    data: unknown;
}

function extractMetadataItems(bundle: any): ExtractedItem[] {
    const items: ExtractedItem[] = [];

    const pushAll = (type: string, arr?: any[]) => {
        for (const item of arr ?? []) {
            if (!item?.name) continue;
            items.push({ type, name: item.name, data: item });
        }
    };

    pushAll('object', bundle?.objects);
    pushAll('view', bundle?.views);
    pushAll('dashboard', bundle?.dashboards);
    pushAll('report', bundle?.reports);
    pushAll('flow', bundle?.flows);
    pushAll('agent', bundle?.agents);
    pushAll('app', bundle?.apps);
    pushAll('action', bundle?.actions);

    return items;
}

function namespaceDatasets(bundle: any): any[] {
    const datasets = Array.isArray(bundle?.data) ? bundle.data : [];
    return datasets;
}

function createTemplateSeeder(
    kernelManager: KernelManager,
    templates: Record<string, ProjectTemplate>,
    envRegistry: EnvironmentDriverRegistry,
): TemplateSeeder {
    const seedBundleForProject = async (projectId: string, bundle: any): Promise<void> => {
        const items = bundle ? extractMetadataItems(bundle) : [];
        const dataSets = bundle ? namespaceDatasets(bundle) : [];

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
            const cached = envRegistry.peekById(projectId);
            const orgId = (cached?.project as any)?.organization_id as string | undefined;
            try { metadata.setDataEngine(engine, orgId, projectId); } catch { /* already set */ }
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

        if (items.length > 0 && typeof engine?.registerApp === 'function') {
            try { (engine as any).registerApp(bundle); } catch { /* best effort */ }
        }

        if (items.length > 0 && typeof engine?.syncSchemas === 'function') {
            try { await engine.syncSchemas(); } catch { /* best effort */ }
        }

        if (dataSets.length > 0) {
            const seedLoader = new SeedLoaderService(engine, metadata, console as any);
            const config = SeedLoaderConfigSchema.parse({});
            await seedLoader.load({ datasets: dataSets, config });
        }

        const driverWithFlush = (kernel as any).services?.driver ?? (kernel as any).getService?.('driver');
        const flushable = typeof driverWithFlush?.flush === 'function'
            ? driverWithFlush
            : null;
        if (flushable) {
            try { await flushable.flush(); } catch { /* best effort */ }
        }
    };

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
            await seedBundleForProject(projectId, bundle);
        },

        async seedBundle({ projectId, bundle }) {
            await seedBundleForProject(projectId, bundle);
        },
    };
}

/**
 * Control-plane plugin that stands up the per-project orchestration layer.
 * Registers `env-registry`, `kernel-manager` and `template-seeder` on the
 * control kernel.
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

        const seeder = createTemplateSeeder(kernelManager, this.config.templates ?? {}, envRegistry);

        ctx.registerService('env-registry', envRegistry);
        ctx.registerService('kernel-manager', kernelManager);
        ctx.registerService('template-seeder', seeder);

        ctx.logger.info?.('MultiProjectPlugin: registered env-registry + kernel-manager + template-seeder');
    };

    destroy = async (): Promise<void> => {
        try { await this.kernelManager?.evictAll(); } catch { /* best effort */ }
    };
}
