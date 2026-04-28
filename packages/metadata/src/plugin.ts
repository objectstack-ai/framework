// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Plugin, PluginContext } from '@objectstack/core';
import { NodeMetadataManager } from './node-metadata-manager.js';
import { MemoryLoader } from './loaders/memory-loader.js';
import { DEFAULT_METADATA_TYPE_REGISTRY } from '@objectstack/spec/kernel';
import type { MetadataPluginConfig } from '@objectstack/spec/kernel';
import {
    SysAgent,
    SysFlow,
    SysObject,
    SysTool,
    SysView,
} from '@objectstack/platform-objects/metadata';

const queryableMetadataObjects = [SysObject, SysView, SysFlow, SysAgent, SysTool];

// Map from ObjectStackDefinition field name to MetadataType name
const ARTIFACT_FIELD_TO_TYPE: Record<string, string> = {
    objects: 'object',
    objectExtensions: 'object_extension',
    apps: 'app',
    views: 'view',
    pages: 'page',
    dashboards: 'dashboard',
    reports: 'report',
    actions: 'action',
    themes: 'theme',
    workflows: 'workflow',
    approvals: 'approval',
    flows: 'flow',
    roles: 'role',
    permissions: 'permission',
    sharingRules: 'sharing_rule',
    policies: 'policy',
    apis: 'api',
    webhooks: 'webhook',
    agents: 'agent',
    ragPipelines: 'rag_pipeline',
    hooks: 'hook',
    mappings: 'mapping',
    analyticsCubes: 'analytics_cube',
    connectors: 'connector',
    data: 'dataset',
};

export interface MetadataPluginOptions {
    rootDir?: string;
    watch?: boolean;
    config?: Partial<MetadataPluginConfig>;
    /** Organization ID for metadata-scoped consumers; MetadataPlugin itself does not persist runtime metadata. */
    organizationId?: string;
    /** Project/environment ID used by local artifact envelopes and metadata-scoped consumers. */
    environmentId?: string;
    /**
     * When set, MetadataPlugin loads metadata from an artifact instead of scanning
     * the filesystem. Only `local-file` is implemented now; `artifact-api` is
     * reserved for M3/M4.
     */
    artifactSource?: { mode: 'local-file'; path: string } | { mode: 'artifact-api'; url: string };
    /**
     * Register the queryable system metadata-storage objects
     * (`sys_object`, `sys_view`, `sys_flow`, `sys_agent`, `sys_tool`) on this
     * kernel. Default `true` for backward compatibility.
     *
     * Set to `false` for **per-project** kernels: in cloud / project mode the
     * control plane is the sole owner of metadata storage tables — exposing
     * them inside each project kernel would leak control-plane schema into
     * business-data namespaces.
     */
    registerSystemObjects?: boolean;
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
            watch: this.options.watch,
            artifactSource: this.options.artifactSource?.mode,
        });

        // Register Metadata Manager as the primary metadata service provider.
        ctx.registerService('metadata', this.manager);
        console.log('[MetadataPlugin] Registered metadata service, has getRegisteredTypes:', typeof this.manager.getRegisteredTypes);

        // Register metadata system objects via the manifest service (if available).
        // MetadataPlugin may init before ObjectQLPlugin, so wrap in try/catch.
        // Skipped when `registerSystemObjects: false` (per-project kernels in
        // cloud / project mode — sys_* live exclusively in the control plane).
        const registerSysObjects = this.options.registerSystemObjects !== false;
        if (registerSysObjects) {
            try {
                const manifestService = ctx.getService<{ register(m: any): void }>('manifest');

                // Register the queryable metadata-layer platform objects.
                manifestService.register({
                    id: 'com.objectstack.metadata-objects',
                    name: 'Metadata Platform Objects',
                    version: '1.0.0',
                    type: 'plugin',
                    scope: 'system',
                    defaultDatasource: 'cloud',
                    objects: queryableMetadataObjects,
                });

                ctx.logger.info('Registered system metadata objects', {
                    queryable: queryableMetadataObjects.map((object) => object.name),
                });
            } catch {
                // ObjectQL not loaded yet — objects will be discovered via legacy fallback
            }
        }

        ctx.logger.info('MetadataPlugin providing metadata service (primary mode)', {
            mode: this.options.artifactSource?.mode ?? 'file-system',
            features: ['watch', 'multi-format', 'query', 'overlay', 'type-registry']
        });
    }

    start = async (ctx: PluginContext) => {
        const src = this.options.artifactSource;

        if (src?.mode === 'local-file') {
            await this._loadFromLocalFile(ctx, src.path);
        } else if (src?.mode === 'artifact-api') {
            // M3/M4 — not yet implemented
            ctx.logger.warn('[MetadataPlugin] artifact-api source is not yet implemented; falling back to file-system scan');
            await this._loadFromFileSystem(ctx);
        } else {
            await this._loadFromFileSystem(ctx);
        }

        // Bridge realtime service from kernel service registry to MetadataManager.
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

    private async _loadFromLocalFile(ctx: PluginContext, filePath: string): Promise<void> {
        ctx.logger.info('[MetadataPlugin] Loading metadata from local artifact file', { path: filePath });

        let raw: unknown;
        try {
            const content = await readFile(filePath, 'utf8');
            raw = JSON.parse(content);
        } catch (e: any) {
            throw new Error(`[MetadataPlugin] Cannot read artifact file at "${filePath}": ${e.message}`);
        }

        // Dynamically import to avoid pulling @objectstack/spec/cloud into every
        // bundle — it includes heavy Zod schemas and is only needed in local mode.
        const { ProjectArtifactSchema } = await import('@objectstack/spec/cloud');
        const { ObjectStackDefinitionSchema } = await import('@objectstack/spec');

        let metadata: Record<string, unknown[]>;

        // Detect envelope vs bare ObjectStackDefinition.
        const obj = raw as any;
        if (obj?.schemaVersion && obj?.commitId && obj?.metadata !== undefined) {
            // Already an artifact envelope — validate and unwrap.
            const artifact = ProjectArtifactSchema.parse(obj);
            metadata = artifact.metadata as Record<string, unknown[]>;
        } else {
            // Bare ObjectStackDefinition produced by `objectstack compile`.
            const def = ObjectStackDefinitionSchema.parse(obj);
            const canonical = JSON.stringify(def, Object.keys(def).sort());
            const checksum = createHash('sha256').update(canonical).digest('hex');
            const projectId = this.options.environmentId ?? 'proj_local';
            // Wrap into envelope and validate to confirm the structure is correct.
            ProjectArtifactSchema.parse({
                schemaVersion: '0.1',
                projectId,
                commitId: 'local-dev',
                checksum,
                metadata: def,
            });
            metadata = def as Record<string, unknown[]>;
        }

        // Register artifact items into a MemoryLoader so they are visible to
        // both `loadMany()` (used by ObjectQL's sync path) and `list()` (used
        // by REST meta endpoints). `register()` alone only writes to the in-memory
        // registry Map which `loadMany()` does not read.
        const memLoader = new MemoryLoader();

        let totalRegistered = 0;
        for (const [field, metaType] of Object.entries(ARTIFACT_FIELD_TO_TYPE)) {
            const items = (metadata as any)[field];
            if (!Array.isArray(items) || items.length === 0) continue;
            for (const item of items) {
                const name = (item as any)?.name;
                if (!name) continue;
                await memLoader.save(metaType, name, item);
                await this.manager.register(metaType, name, item);
                totalRegistered++;
            }
        }

        // Mount the loader so `loadMany` queries hit it.
        this.manager.registerLoader(memLoader);

        ctx.logger.info('[MetadataPlugin] Artifact metadata loaded', {
            path: filePath,
            totalRegistered,
        });
    }

    private async _loadFromFileSystem(ctx: PluginContext): Promise<void> {
        ctx.logger.info('Loading metadata from file system...');

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
