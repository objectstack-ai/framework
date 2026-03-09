// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext, IHttpServer } from '@objectstack/core';
import {
    RestServerConfig,
} from '@objectstack/spec/api';
import { HonoHttpServer } from './adapter';
import { serveStatic } from '@hono/node-server/serve-static';
import * as fs from 'fs';
import * as path from 'path';

export interface StaticMount {
    root: string;
    path?: string;
    rewrite?: boolean;
    spa?: boolean;
}

export interface HonoPluginOptions {
    port?: number;
    staticRoot?: string;
    /**
     * Multiple static resource mounts
     */
    staticMounts?: StaticMount[];
    /**
     * REST server configuration
     * Controls automatic endpoint generation and API behavior
     */
    restConfig?: RestServerConfig;
    /**
     * Whether to register standard ObjectStack CRUD endpoints
     * @default true
     */
    registerStandardEndpoints?: boolean;
    /**
     * Whether to load endpoints from API Registry
     * @default true
     */
    useApiRegistry?: boolean;

    /**
     * Whether to enable SPA fallback
     * If true, returns index.html for non-API 404s
     * @default false
     */
    spaFallback?: boolean;
}

/**
 * Hono Server Plugin
 * 
 * Provides HTTP server capabilities using Hono framework.
 * Registers the IHttpServer service so other plugins can register routes.
 * 
 * Route registration is handled by plugins:
 * - `@objectstack/rest` → CRUD, metadata, discovery, UI, batch
 * - `createDispatcherPlugin()` → auth, graphql, analytics, packages, etc.
 */
export class HonoServerPlugin implements Plugin {
    name = 'com.objectstack.server.hono';
    type = 'server';
    version = '0.9.0';
    
    // Constants
    private static readonly DEFAULT_ENDPOINT_PRIORITY = 100;
    private static readonly CORE_ENDPOINT_PRIORITY = 950;
    private static readonly DISCOVERY_ENDPOINT_PRIORITY = 900;
    
    private options: HonoPluginOptions;
    private server: HonoHttpServer;

    constructor(options: HonoPluginOptions = {}) {
        this.options = { 
            port: 3000,
            registerStandardEndpoints: true,
            useApiRegistry: true,
            spaFallback: false,
            ...options
        };
        // We handle static root manually in start() to support SPA fallback
        this.server = new HonoHttpServer(this.options.port);
    }

    /**
     * Init phase - Setup HTTP server and register as service
     */
    init = async (ctx: PluginContext) => {
        ctx.logger.debug('Initializing Hono server plugin', { 
            port: this.options.port,
            staticRoot: this.options.staticRoot 
        });
        
        // Register HTTP server service as IHttpServer
        // Register as 'http.server' to match core requirements
        ctx.registerService('http.server', this.server);
        // Alias 'http-server' for backward compatibility
        ctx.registerService('http-server', this.server);
        ctx.logger.debug('HTTP server service registered', { serviceName: 'http.server' });
    }

    /**
     * Start phase - Configure static files and start listening
     */
    start = async (ctx: PluginContext) => {
        ctx.logger.debug('Starting Hono server plugin');

        // Configure Static Files & SPA Fallback
        const mounts: StaticMount[] = this.options.staticMounts || [];

        // Auto-discover UI Plugins
        try {
            const rawKernel = ctx.getKernel() as any;
            if (rawKernel.plugins) {
                const loadedPlugins = rawKernel.plugins instanceof Map 
                    ? Array.from(rawKernel.plugins.values()) 
                    : Array.isArray(rawKernel.plugins) ? rawKernel.plugins : Object.values(rawKernel.plugins);

                for (const plugin of (loadedPlugins as any[])) {
                    // Check for UI Plugin signature
                    // Support legacy 'ui-plugin' and new 'ui' type
                    if ((plugin.type === 'ui' || plugin.type === 'ui-plugin') && plugin.staticPath) {
                        // Derive base route from name: @org/console -> console
                        const slug = plugin.slug || plugin.name.split('/').pop();
                        const baseRoute = `/${slug}`;
                        
                        ctx.logger.debug(`Auto-mounting UI Plugin: ${plugin.name}`, { 
                            path: baseRoute, 
                            root: plugin.staticPath 
                        });

                        mounts.push({
                            root: plugin.staticPath,
                            path: baseRoute,
                            rewrite: true, // Strip prefix: /console/assets/x -> /assets/x
                            spa: true
                        });

                        // Handle Default Plugin Redirect
                        if (plugin.default || plugin.isDefault) {
                             const rawApp = this.server.getRawApp();
                             rawApp.get('/', (c) => c.redirect(baseRoute));
                             ctx.logger.debug(`Set default UI redirect: / -> ${baseRoute}`);
                        }
                    }
                }
            }
        } catch (err: any) {
            ctx.logger.warn('Failed to auto-discover UI plugins', { error: err.message || err });
        }

        // Backward compatibility for staticRoot
        if (this.options.staticRoot) {
            mounts.push({
                root: this.options.staticRoot,
                path: '/',
                rewrite: false,
                spa: this.options.spaFallback
            });
        }

        if (mounts.length > 0) {
            const rawApp = this.server.getRawApp();
            
            for (const mount of mounts) {
                const mountRoot = path.resolve(process.cwd(), mount.root);

                if (!fs.existsSync(mountRoot)) {
                    ctx.logger.warn(`Static mount root not found: ${mountRoot}. Skipping.`);
                    continue;
                }

                const mountPath = mount.path || '/';
                const normalizedPath = mountPath.startsWith('/') ? mountPath : `/${mountPath}`;
                const routePattern = normalizedPath === '/' ? '/*' : `${normalizedPath.replace(/\/$/, '')}/*`;
                
                // Routes to register: both /mount and /mount/*
                const routes = normalizedPath === '/' ? [routePattern] : [normalizedPath, routePattern];

                ctx.logger.debug('Mounting static files', { 
                    to: routes, 
                    from: mountRoot, 
                    rewrite: mount.rewrite, 
                    spa: mount.spa 
                });

                routes.forEach(route => {
                    // 1. Serve Static Files
                    rawApp.get(
                        route, 
                        serveStatic({ 
                            root: mount.root,
                            rewriteRequestPath: (reqPath) => {
                                if (mount.rewrite && normalizedPath !== '/') {
                                    // /console/assets/style.css -> /assets/style.css
                                    if (reqPath.startsWith(normalizedPath)) {
                                        return reqPath.substring(normalizedPath.length) || '/';
                                    }
                                }
                                return reqPath;
                            }
                        })
                    );

                    // 2. SPA Fallback (Scoped)
                    if (mount.spa) {
                        rawApp.get(route, async (c, next) => {
                            // Skip if API path check
                            const config = this.options.restConfig || {};
                            const basePath = config.api?.basePath || '/api';
                            
                            if (c.req.path.startsWith(basePath)) {
                                return next();
                            }

                            return serveStatic({ 
                                root: mount.root,
                                rewriteRequestPath: () => 'index.html'
                            })(c, next);
                        });
                    }
                });
            }
        }

        // Start server on kernel:ready hook
        ctx.hook('kernel:ready', async () => {
            // Register standard endpoints before starting to listen
            if (this.options.registerStandardEndpoints) {
                this.registerDiscoveryAndCrudEndpoints(ctx);
            }

            const port = this.options.port ?? 3000;
            ctx.logger.debug('Starting HTTP server', { port });
            
            await this.server.listen(port);
            
            const actualPort = this.server.getPort();
            ctx.logger.info('HTTP server started successfully', { 
                port: actualPort, 
                url: `http://localhost:${actualPort}` 
            });
        });
    }

    /**
     * Register discovery and basic CRUD endpoints.
     * Called when `registerStandardEndpoints` is true, before the server starts listening.
     */
    private registerDiscoveryAndCrudEndpoints(ctx: PluginContext) {
        const rawApp = this.server.getRawApp();
        const prefix = '/api/v1';

        // Build the standard discovery response
        const discovery = {
            version: 'v1',
            apiName: 'ObjectStack API',
            routes: {
                data:          `${prefix}/data`,
                metadata:      `${prefix}/meta`,
                auth:          `${prefix}/auth`,
                packages:      `${prefix}/packages`,
                analytics:     `${prefix}/analytics`,
                realtime:      `${prefix}/realtime`,
                workflow:      `${prefix}/workflow`,
                automation:    `${prefix}/automation`,
                ai:            `${prefix}/ai`,
                notifications: `${prefix}/notifications`,
                i18n:          `${prefix}/i18n`,
                storage:       `${prefix}/storage`,
                ui:            `${prefix}/ui`,
            },
        };

        // Discovery endpoints
        rawApp.get('/.well-known/objectstack', (c: any) => c.json({ data: discovery }));
        rawApp.get(prefix, (c: any) => c.json({ data: discovery }));

        ctx.logger.info('Registered discovery endpoints', { prefix });

        // Basic CRUD data endpoints — delegate to kernel.broker when available
        const getBroker = () => (ctx.getKernel() as any).broker;

        // Create
        rawApp.post(`${prefix}/data/:object`, async (c: any) => {
            const broker = getBroker();
            if (!broker) return c.json({ error: 'Broker not available' }, 500);
            const object = c.req.param('object');
            const data = await c.req.json().catch(() => ({}));
            const result = await broker.call('data.create', { object, data }, {});
            return c.json(result);
        });

        // Get by ID
        rawApp.get(`${prefix}/data/:object/:id`, async (c: any) => {
            const broker = getBroker();
            if (!broker) return c.json({ error: 'Broker not available' }, 500);
            const object = c.req.param('object');
            const id = c.req.param('id');
            const result = await broker.call('data.get', { object, id }, {});
            return result ? c.json(result) : c.json({ error: 'Not found' }, 404);
        });

        // Find / List
        rawApp.get(`${prefix}/data/:object`, async (c: any) => {
            const broker = getBroker();
            if (!broker) return c.json({ error: 'Broker not available' }, 500);
            const object = c.req.param('object');
            const filters = c.req.query();
            const result = await broker.call('data.find', { object, filters }, {});
            return c.json(result);
        });

        ctx.logger.debug('Registered standard CRUD data endpoints', { prefix });
    }

    /**
     * Destroy phase - Stop server
     */
    async destroy() {
        this.server.close();
        // Note: Can't use ctx.logger here since we're in destroy
        console.log('[HonoServerPlugin] Server stopped');
    }
}
