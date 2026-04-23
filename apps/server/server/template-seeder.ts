// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { SeedLoaderService } from '@objectstack/runtime';
import type { KernelManager } from '@objectstack/runtime';
import { templateRegistry, listTemplates } from './templates/registry.js';
import { extractMetadataItems } from './templates/extract.js';

export interface TemplateSeeder {
    seed(params: { projectId: string; templateId: string }): Promise<void>;
    listTemplates(): Array<{ id: string; label: string; description: string; category?: string }>;
}

export function createTemplateSeeder(kernelManager: KernelManager): TemplateSeeder {
    return {
        listTemplates,

        async seed({ projectId, templateId }) {
            const template = templateRegistry[templateId];
            if (!template) {
                throw new Error(
                    `Unknown template: '${templateId}'. Available: [${Object.keys(templateRegistry).join(', ')}]`,
                );
            }

            // blank has no metadata to seed — skip early
            if (templateId === 'blank') return;

            const bundle = await template.load();
            const items = extractMetadataItems(bundle);

            if (items.length === 0) {
                throw new Error(
                    `template '${templateId}' produced 0 metadata items — bundle shape unexpected (keys=[${bundle ? Object.keys(bundle).join(',') : 'null'}])`,
                );
            }

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

            const engine: any = await kernel
                .getServiceAsync('objectql')
                .catch(() => null);
            if (!engine) {
                throw new Error(
                    `objectql engine unavailable for project ${projectId} — metadata persistence would be in-memory only`,
                );
            }
            if (typeof metadata.setDataEngine === 'function') {
                // Defensive: ensure DatabaseLoader is wired even if
                // MetadataPlugin.start() missed it (e.g. plugin order race).
                try { metadata.setDataEngine(engine, undefined, projectId); } catch { /* already set */ }
            }

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

            // Seed row data if the bundle ships datasets
            if (Array.isArray(bundle.data) && bundle.data.length > 0) {
                const seedLoader = new SeedLoaderService(
                    engine,
                    metadata,
                    console as any,
                );
                await seedLoader.load({ datasets: bundle.data, config: {} });
            }
        },
    };
}
