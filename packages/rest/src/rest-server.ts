// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { IHttpServer } from '@objectstack/core';
import { RouteManager } from './route-manager.js';
import { RestServerConfig, RestApiConfig, CrudEndpointsConfig, MetadataEndpointsConfig, BatchEndpointsConfig, RouteGenerationConfig } from '@objectstack/spec/api';
import { ObjectStackProtocol } from '@objectstack/spec/api';

/**
 * Structural subset of `KernelManager` that RestServer needs in order to
 * resolve a per-project protocol at request time. Typed locally to avoid
 * an @objectstack/runtime → @objectstack/rest → @objectstack/runtime
 * package cycle.
 */
export interface RestKernelManager {
    getOrCreate(projectId: string): Promise<{
        getServiceAsync<T = unknown>(name: string): Promise<T>;
    }>;
}

/**
 * Normalized REST Server Configuration
 * All nested properties are required after normalization
 */
type NormalizedRestServerConfig = {
    api: {
        version: string;
        basePath: string;
        apiPath: string | undefined;
        enableCrud: boolean;
        enableMetadata: boolean;
        enableUi: boolean;
        enableBatch: boolean;
        enableDiscovery: boolean;
        enableProjectScoping: boolean;
        projectResolution: 'required' | 'optional' | 'auto';
        documentation: RestApiConfig['documentation'];
        responseFormat: RestApiConfig['responseFormat'];
    };
    crud: {
        operations: {
            create: boolean;
            read: boolean;
            update: boolean;
            delete: boolean;
            list: boolean;
        };
        patterns: CrudEndpointsConfig['patterns'];
        dataPrefix: string;
        objectParamStyle: 'path' | 'query';
    };
    metadata: {
        prefix: string;
        enableCache: boolean;
        cacheTtl: number;
        endpoints: {
            types: boolean;
            items: boolean;
            item: boolean;
            schema: boolean;
        };
    };
    batch: {
        maxBatchSize: number;
        enableBatchEndpoint: boolean;
        operations: {
            createMany: boolean;
            updateMany: boolean;
            deleteMany: boolean;
            upsertMany: boolean;
        };
        defaultAtomic: boolean;
    };
    routes: {
        includeObjects: string[] | undefined;
        excludeObjects: string[] | undefined;
        nameTransform: 'none' | 'plural' | 'kebab-case' | 'camelCase';
        overrides: RouteGenerationConfig['overrides'];
    };
};

/**
 * RestServer
 * 
 * Provides automatic REST API endpoint generation for ObjectStack.
 * Generates standard RESTful CRUD endpoints, metadata endpoints, and batch operations
 * based on the configured protocol provider.
 * 
 * Features:
 * - Automatic CRUD endpoint generation (GET, POST, PUT, PATCH, DELETE)
 * - Metadata API endpoints (/meta)
 * - Batch operation endpoints (/batch, /createMany, /updateMany, /deleteMany)
 * - Discovery endpoint
 * - Configurable path prefixes and patterns
 * 
 * @example
 * const restServer = new RestServer(httpServer, protocolProvider, {
 *   api: {
 *     version: 'v1',
 *     basePath: '/api'
 *   },
 *   crud: {
 *     dataPrefix: '/data'
 *   }
 * });
 * 
 * restServer.registerRoutes();
 */
export class RestServer {
    private protocol: ObjectStackProtocol;
    private config: NormalizedRestServerConfig;
    private routeManager: RouteManager;
    private kernelManager?: RestKernelManager;

    constructor(
        server: IHttpServer,
        protocol: ObjectStackProtocol,
        config: RestServerConfig = {},
        kernelManager?: RestKernelManager,
    ) {
        this.protocol = protocol;
        this.config = this.normalizeConfig(config);
        this.routeManager = new RouteManager(server);
        this.kernelManager = kernelManager;
    }

    /**
     * Resolve the protocol for a given request. When `projectId` is present
     * and a KernelManager is wired, fetch the per-project kernel's
     * `protocol` service so metadata / data / UI reads hit the project's
     * own registry and datastore. Otherwise fall back to the control-kernel
     * protocol captured at boot.
     */
    private async resolveProtocol(projectId?: string): Promise<ObjectStackProtocol> {
        if (!projectId || !this.kernelManager) return this.protocol;
        const kernel = await this.kernelManager.getOrCreate(projectId);
        return kernel.getServiceAsync<ObjectStackProtocol>('protocol');
    }
    
    /**
     * Normalize configuration with defaults
     */
    private normalizeConfig(config: RestServerConfig): NormalizedRestServerConfig {
        const api = (config.api ?? {}) as Partial<RestApiConfig>;
        const crud = (config.crud ?? {}) as Partial<CrudEndpointsConfig>;
        const metadata = (config.metadata ?? {}) as Partial<MetadataEndpointsConfig>;
        const batch = (config.batch ?? {}) as Partial<BatchEndpointsConfig>;
        const routes = (config.routes ?? {}) as Partial<RouteGenerationConfig>;
        
        return {
            api: {
                version: api.version ?? 'v1',
                basePath: api.basePath ?? '/api',
                apiPath: api.apiPath,
                enableCrud: api.enableCrud ?? true,
                enableMetadata: api.enableMetadata ?? true,
                enableUi: api.enableUi ?? true,
                enableBatch: api.enableBatch ?? true,
                enableDiscovery: api.enableDiscovery ?? true,
                enableProjectScoping: api.enableProjectScoping ?? false,
                projectResolution: api.projectResolution ?? 'auto',
                documentation: api.documentation,
                responseFormat: api.responseFormat,
            },
            crud: {
                operations: crud.operations ?? {
                    create: true,
                    read: true,
                    update: true,
                    delete: true,
                    list: true,
                },
                patterns: crud.patterns,
                dataPrefix: crud.dataPrefix ?? '/data',
                objectParamStyle: crud.objectParamStyle ?? 'path',
            },
            metadata: {
                prefix: metadata.prefix ?? '/meta',
                enableCache: metadata.enableCache ?? true,
                cacheTtl: metadata.cacheTtl ?? 3600,
                endpoints: metadata.endpoints ?? {
                    types: true,
                    items: true,
                    item: true,
                    schema: true,
                },
            },
            batch: {
                maxBatchSize: batch.maxBatchSize ?? 200,
                enableBatchEndpoint: batch.enableBatchEndpoint ?? true,
                operations: batch.operations ?? {
                    createMany: true,
                    updateMany: true,
                    deleteMany: true,
                    upsertMany: true,
                },
                defaultAtomic: batch.defaultAtomic ?? true,
            },
            routes: {
                includeObjects: routes.includeObjects,
                excludeObjects: routes.excludeObjects,
                nameTransform: routes.nameTransform ?? 'none',
                overrides: routes.overrides,
            },
        };
    }
    
    /**
     * Get the full API base path
     */
    private getApiBasePath(): string {
        const { api } = this.config;
        return api.apiPath ?? `${api.basePath}/${api.version}`;
    }

    /**
     * Get the project-scoped base path for a given unscoped base.
     * Example: `/api/v1` → `/api/v1/projects/:projectId`.
     */
    private getScopedBasePath(basePath: string): string {
        return `${basePath}/projects/:projectId`;
    }

    /**
     * Register all REST API routes
     *
     * When `enableProjectScoping` is true, routes are registered under
     * `/api/v1/projects/:projectId/...`. The `projectResolution` strategy
     * controls whether unscoped legacy routes remain available:
     *   - `required` → only scoped routes registered.
     *   - `optional` / `auto` → both scoped and unscoped routes registered.
     */
    registerRoutes(): void {
        const basePath = this.getApiBasePath();
        const { enableProjectScoping, projectResolution } = this.config.api;

        const registerForBase = (bp: string) => {
            if (this.config.api.enableDiscovery) {
                this.registerDiscoveryEndpoints(bp);
            }
            if (this.config.api.enableMetadata) {
                this.registerMetadataEndpoints(bp);
            }
            if (this.config.api.enableUi) {
                this.registerUiEndpoints(bp);
            }
            if (this.config.api.enableCrud) {
                this.registerCrudEndpoints(bp);
            }
            if (this.config.api.enableBatch) {
                this.registerBatchEndpoints(bp);
            }
        };

        if (enableProjectScoping) {
            const scopedBase = this.getScopedBasePath(basePath);
            if (projectResolution === 'required') {
                // Strict: only scoped routes
                registerForBase(scopedBase);
            } else {
                // 'optional' | 'auto' — keep both so legacy callers keep working
                registerForBase(basePath);
                registerForBase(scopedBase);
            }
        } else {
            registerForBase(basePath);
        }
    }
    
    /**
     * Register discovery endpoints
     */
    private registerDiscoveryEndpoints(basePath: string): void {
        const isScoped = basePath.includes('/projects/:projectId');
        const discoveryHandler = async (req: any, res: any) => {
                try {
                    const discovery = await this.protocol.getDiscovery();

                    // Override discovery information with actual server configuration
                    discovery.version = this.config.api.version;

                    // Substitute the resolved projectId into the advertised routes so
                    // clients can consume them verbatim (e.g. /api/v1/projects/abc/data).
                    const realBase = isScoped
                        ? basePath.replace(':projectId', req.params?.projectId ?? ':projectId')
                        : basePath;

                    if (discovery.routes) {
                        // Ensure routes match the actual mounted paths
                        if (this.config.api.enableCrud) {
                            discovery.routes.data = `${realBase}${this.config.crud.dataPrefix}`;
                        }

                        if (this.config.api.enableMetadata) {
                            discovery.routes.metadata = `${realBase}${this.config.metadata.prefix}`;
                        }

                        if (this.config.api.enableUi) {
                            discovery.routes.ui = `${realBase}/ui`;
                        }

                        // Align auth route with the versioned base path if present.
                        // Auth is a control-plane concern, so use the unscoped base.
                        if (discovery.routes.auth) {
                            const unscopedBase = isScoped
                                ? basePath.replace(/\/projects\/:projectId$/, '')
                                : basePath;
                            discovery.routes.auth = `${unscopedBase}/auth`;
                        }
                    }

                    // Attach scoping metadata so clients can detect dual-mode routing.
                    (discovery as any).scoping = {
                        enabled: this.config.api.enableProjectScoping,
                        resolution: this.config.api.projectResolution,
                        scoped: isScoped,
                        projectId: isScoped ? req.params?.projectId : undefined,
                    };

                    res.json(discovery);
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            };

        // Register at basePath (e.g. /api/v1)
        this.routeManager.register({
            method: 'GET',
            path: basePath,
            handler: discoveryHandler,
            metadata: {
                summary: 'Get API discovery information',
                tags: ['discovery'],
            },
        });

        // Register at basePath/discovery (e.g. /api/v1/discovery)
        this.routeManager.register({
            method: 'GET',
            path: `${basePath}/discovery`,
            handler: discoveryHandler,
            metadata: {
                summary: 'Get API discovery information',
                tags: ['discovery'],
            },
        });
    }
    
    /**
     * Register metadata endpoints
     */
    private registerMetadataEndpoints(basePath: string): void {
        const { metadata } = this.config;
        const metaPath = `${basePath}${metadata.prefix}`;
        const isScoped = basePath.includes('/projects/:projectId');

        // GET /meta - List all metadata types
        if (metadata.endpoints.types !== false) {
            this.routeManager.register({
                method: 'GET',
                path: metaPath,
                handler: async (req: any, res: any) => {
                    try {
                        const projectId = isScoped ? req.params?.projectId : undefined;
                        const p = await this.resolveProtocol(projectId);
                        const types = await p.getMetaTypes();
                        res.json(types);
                    } catch (error: any) {
                        res.status(500).json({ error: error.message });
                    }
                },
                metadata: {
                    summary: 'List all metadata types',
                    tags: ['metadata'],
                },
            });
        }

        // GET /meta/:type - List items of a type
        if (metadata.endpoints.items !== false) {
            this.routeManager.register({
                method: 'GET',
                path: `${metaPath}/:type`,
                handler: async (req: any, res: any) => {
                    try {
                        const packageId = req.query?.package || undefined;
                        const projectId = isScoped ? req.params?.projectId : undefined;
                        const p = await this.resolveProtocol(projectId);
                        const items = await p.getMetaItems({
                            type: req.params.type,
                            packageId,
                        } as any);
                        res.json(items);
                    } catch (error: any) {
                        res.status(404).json({ error: error.message });
                    }
                },
                metadata: {
                    summary: 'List metadata items of a type',
                    tags: ['metadata'],
                },
            });
        }

        // GET /meta/:type/:name - Get specific item
        if (metadata.endpoints.item !== false) {
            this.routeManager.register({
                method: 'GET',
                path: `${metaPath}/:type/:name`,
                handler: async (req: any, res: any) => {
                    try {
                        const projectId = isScoped ? req.params?.projectId : undefined;
                        const p = await this.resolveProtocol(projectId);
                        // Check if cached version is available
                        if (metadata.enableCache && p.getMetaItemCached) {
                            const cacheRequest = {
                                ifNoneMatch: req.headers['if-none-match'] as string,
                                ifModifiedSince: req.headers['if-modified-since'] as string,
                            };

                            const result = await p.getMetaItemCached({
                                type: req.params.type,
                                name: req.params.name,
                                cacheRequest,
                            } as any);

                            if (result.notModified) {
                                res.status(304).send();
                                return;
                            }

                            // Set cache headers
                            if (result.etag) {
                                const etagValue = result.etag.weak
                                    ? `W/"${result.etag.value}"`
                                    : `"${result.etag.value}"`;
                                res.header('ETag', etagValue);
                            }
                            if (result.lastModified) {
                                res.header('Last-Modified', new Date(result.lastModified).toUTCString());
                            }
                            if (result.cacheControl) {
                                const directives = result.cacheControl.directives.join(', ');
                                const maxAge = result.cacheControl.maxAge
                                    ? `, max-age=${result.cacheControl.maxAge}`
                                    : '';
                                res.header('Cache-Control', directives + maxAge);
                            }

                            res.json(result.data);
                        } else {
                            // Non-cached version
                            const packageId = req.query?.package || undefined;
                            const item = await p.getMetaItem({
                                type: req.params.type,
                                name: req.params.name,
                                packageId,
                            } as any);
                            res.json(item);
                        }
                    } catch (error: any) {
                        res.status(404).json({ error: error.message });
                    }
                },
                metadata: {
                    summary: 'Get specific metadata item',
                    tags: ['metadata'],
                },
            });
        }

        // PUT /meta/:type/:name - Save metadata item
        // We always register this route, but return 501 if protocol doesn't support it
        // This makes it discoverable even if not implemented
        this.routeManager.register({
            method: 'PUT',
            path: `${metaPath}/:type/:name`,
            handler: async (req: any, res: any) => {
                try {
                    const projectId = isScoped ? req.params?.projectId : undefined;
                    const p = await this.resolveProtocol(projectId);
                    if (!p.saveMetaItem) {
                        res.status(501).json({ error: 'Save operation not supported by protocol implementation' });
                        return;
                    }

                    const result = await p.saveMetaItem({
                        type: req.params.type,
                        name: req.params.name,
                        item: req.body,
                    } as any);
                    res.json(result);
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            },
            metadata: {
                summary: 'Save specific metadata item',
                tags: ['metadata'],
            },
        });
    }

    /**
     * Register UI endpoints
     */
    private registerUiEndpoints(basePath: string): void {
        const uiPath = `${basePath}/ui`;
        const isScoped = basePath.includes('/projects/:projectId');

        // GET /ui/view/:object/:type - Resolve view for object
        this.routeManager.register({
            method: 'GET',
            path: `${uiPath}/view/:object/:type`,
            handler: async (req: any, res: any) => {
                try {
                    const projectId = isScoped ? req.params?.projectId : undefined;
                    const p = await this.resolveProtocol(projectId);
                    if (p.getUiView) {
                        const view = await p.getUiView({
                            object: req.params.object,
                            type: req.params.type as any,
                        } as any);
                        res.json(view);
                    } else {
                        res.status(501).json({ error: 'UI View resolution not supported by protocol implementation' });
                    }
                } catch (error: any) {
                    res.status(404).json({ error: error.message });
                }
            },
            metadata: {
                summary: 'Resolve UI View for object',
                tags: ['ui'],
            },
        });
    }
    
    /**
     * Register CRUD endpoints for data operations
     */
    private registerCrudEndpoints(basePath: string): void {
        const { crud } = this.config;
        const dataPath = `${basePath}${crud.dataPrefix}`;
        const isScoped = basePath.includes('/projects/:projectId');

        const operations = crud.operations;

        // GET /data/:object - List/query records
        if (operations.list) {
            this.routeManager.register({
                method: 'GET',
                path: `${dataPath}/:object`,
                handler: async (req: any, res: any) => {
                    try {
                        const projectId = isScoped ? req.params?.projectId : undefined;
                        const p = await this.resolveProtocol(projectId);
                        const result = await p.findData({
                            object: req.params.object,
                            query: req.query,
                        } as any);
                        res.json(result);
                    } catch (error: any) {
                        res.status(400).json({ error: error.message });
                    }
                },
                metadata: {
                    summary: 'Query records',
                    tags: ['data', 'crud'],
                },
            });
        }

        // GET /data/:object/:id - Get single record
        if (operations.read) {
            this.routeManager.register({
                method: 'GET',
                path: `${dataPath}/:object/:id`,
                handler: async (req: any, res: any) => {
                    try {
                        const projectId = isScoped ? req.params?.projectId : undefined;
                        const p = await this.resolveProtocol(projectId);
                        const { select, expand } = req.query || {};
                        const result = await p.getData({
                            object: req.params.object,
                            id: req.params.id,
                            ...(select != null ? { select } : {}),
                            ...(expand != null ? { expand } : {}),
                        } as any);
                        res.json(result);
                    } catch (error: any) {
                        res.status(404).json({ error: error.message });
                    }
                },
                metadata: {
                    summary: 'Get record by ID',
                    tags: ['data', 'crud'],
                },
            });
        }

        // POST /data/:object - Create record
        if (operations.create) {
            this.routeManager.register({
                method: 'POST',
                path: `${dataPath}/:object`,
                handler: async (req: any, res: any) => {
                    try {
                        const projectId = isScoped ? req.params?.projectId : undefined;
                        const p = await this.resolveProtocol(projectId);
                        const result = await p.createData({
                            object: req.params.object,
                            data: req.body,
                        } as any);
                        res.status(201).json(result);
                    } catch (error: any) {
                        res.status(400).json({ error: error.message });
                    }
                },
                metadata: {
                    summary: 'Create record',
                    tags: ['data', 'crud'],
                },
            });
        }

        // PATCH /data/:object/:id - Update record
        if (operations.update) {
            this.routeManager.register({
                method: 'PATCH',
                path: `${dataPath}/:object/:id`,
                handler: async (req: any, res: any) => {
                    try {
                        const projectId = isScoped ? req.params?.projectId : undefined;
                        const p = await this.resolveProtocol(projectId);
                        const result = await p.updateData({
                            object: req.params.object,
                            id: req.params.id,
                            data: req.body,
                        } as any);
                        res.json(result);
                    } catch (error: any) {
                        res.status(400).json({ error: error.message });
                    }
                },
                metadata: {
                    summary: 'Update record',
                    tags: ['data', 'crud'],
                },
            });
        }

        // DELETE /data/:object/:id - Delete record
        if (operations.delete) {
            this.routeManager.register({
                method: 'DELETE',
                path: `${dataPath}/:object/:id`,
                handler: async (req: any, res: any) => {
                    try {
                        const projectId = isScoped ? req.params?.projectId : undefined;
                        const p = await this.resolveProtocol(projectId);
                        const result = await p.deleteData({
                            object: req.params.object,
                            id: req.params.id,
                        } as any);
                        res.json(result);
                    } catch (error: any) {
                        res.status(400).json({ error: error.message });
                    }
                },
                metadata: {
                    summary: 'Delete record',
                    tags: ['data', 'crud'],
                },
            });
        }
    }
    
    /**
     * Register batch operation endpoints
     */
    private registerBatchEndpoints(basePath: string): void {
        const { crud, batch } = this.config;
        const dataPath = `${basePath}${crud.dataPrefix}`;
        const isScoped = basePath.includes('/projects/:projectId');

        const operations = batch.operations;

        // POST /data/:object/batch - Generic batch endpoint
        if (batch.enableBatchEndpoint && this.protocol.batchData) {
            this.routeManager.register({
                method: 'POST',
                path: `${dataPath}/:object/batch`,
                handler: async (req: any, res: any) => {
                    try {
                        const projectId = isScoped ? req.params?.projectId : undefined;
                        const p = await this.resolveProtocol(projectId);
                        const result = await p.batchData!({
                            object: req.params.object,
                            request: req.body,
                        } as any);
                        res.json(result);
                    } catch (error: any) {
                        res.status(400).json({ error: error.message });
                    }
                },
                metadata: {
                    summary: 'Batch operations',
                    tags: ['data', 'batch'],
                },
            });
        }

        // POST /data/:object/createMany - Bulk create
        if (operations.createMany && this.protocol.createManyData) {
            this.routeManager.register({
                method: 'POST',
                path: `${dataPath}/:object/createMany`,
                handler: async (req: any, res: any) => {
                    try {
                        const projectId = isScoped ? req.params?.projectId : undefined;
                        const p = await this.resolveProtocol(projectId);
                        const result = await p.createManyData!({
                            object: req.params.object,
                            records: req.body || [],
                        } as any);
                        res.status(201).json(result);
                    } catch (error: any) {
                        res.status(400).json({ error: error.message });
                    }
                },
                metadata: {
                    summary: 'Create multiple records',
                    tags: ['data', 'batch'],
                },
            });
        }

        // POST /data/:object/updateMany - Bulk update
        if (operations.updateMany && this.protocol.updateManyData) {
            this.routeManager.register({
                method: 'POST',
                path: `${dataPath}/:object/updateMany`,
                handler: async (req: any, res: any) => {
                    try {
                        const projectId = isScoped ? req.params?.projectId : undefined;
                        const p = await this.resolveProtocol(projectId);
                        const result = await p.updateManyData!({
                            object: req.params.object,
                            ...req.body,
                        } as any);
                        res.json(result);
                    } catch (error: any) {
                        res.status(400).json({ error: error.message });
                    }
                },
                metadata: {
                    summary: 'Update multiple records',
                    tags: ['data', 'batch'],
                },
            });
        }

        // POST /data/:object/deleteMany - Bulk delete
        if (operations.deleteMany && this.protocol.deleteManyData) {
            this.routeManager.register({
                method: 'POST',
                path: `${dataPath}/:object/deleteMany`,
                handler: async (req: any, res: any) => {
                    try {
                        const projectId = isScoped ? req.params?.projectId : undefined;
                        const p = await this.resolveProtocol(projectId);
                        const result = await p.deleteManyData!({
                            object: req.params.object,
                            ...req.body,
                        } as any);
                        res.json(result);
                    } catch (error: any) {
                        res.status(400).json({ error: error.message });
                    }
                },
                metadata: {
                    summary: 'Delete multiple records',
                    tags: ['data', 'batch'],
                },
            });
        }
    }

    
    /**
     * Get the route manager
     */
    getRouteManager(): RouteManager {
        return this.routeManager;
    }
    
    /**
     * Get all registered routes
     */
    getRoutes() {
        return this.routeManager.getAll();
    }
}
