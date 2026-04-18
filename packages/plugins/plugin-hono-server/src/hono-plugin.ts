// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext, IHttpServer, IDataEngine } from '@objectstack/core';
import {
    RestServerConfig,
} from '@objectstack/spec/api';
import { HonoHttpServer, HonoCorsOptions } from './adapter';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import * as fs from 'fs';
import * as path from 'path';
import { createOriginMatcher, hasWildcardPattern, isLocalhostOrigin } from './pattern-matcher';

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

    /**
     * CORS configuration. Set to `false` to disable entirely.
     * Enabled by default with origin '*'.
     * Can also be controlled via environment variables:
     *   CORS_ENABLED, CORS_ORIGIN, CORS_CREDENTIALS, CORS_MAX_AGE
     */
    cors?: HonoCorsOptions | false;
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

        // ─── CORS Middleware ──────────────────────────────────────────────────
        // Enabled by default. Controlled via options.cors or environment variables.
        const corsDisabledByEnv = process.env.CORS_ENABLED === 'false';
        if (this.options.cors !== false && !corsDisabledByEnv) {
            const corsOpts = typeof this.options.cors === 'object' ? this.options.cors : {};
            const enabled = corsOpts.enabled ?? true;

            if (enabled) {
                let configuredOrigin: string | string[];
                if (corsOpts.origins) {
                    configuredOrigin = corsOpts.origins;
                } else if (process.env.CORS_ORIGIN) {
                    const envOrigin = process.env.CORS_ORIGIN.trim();
                    configuredOrigin = envOrigin.includes(',') ? envOrigin.split(',').map(s => s.trim()) : envOrigin;
                } else {
                    configuredOrigin = '*';
                }

                const credentials = corsOpts.credentials ?? (process.env.CORS_CREDENTIALS !== 'false');
                const maxAge = corsOpts.maxAge ?? (process.env.CORS_MAX_AGE ? parseInt(process.env.CORS_MAX_AGE, 10) : 86400);

                // Determine origin handler based on configuration.
                // Always use a function so that localhost origins are
                // automatically allowed regardless of the configured
                // pattern list (handled inside matchOriginPattern /
                // createOriginMatcher).
                let origin: string | string[] | ((origin: string) => string | undefined | null);

                // When credentials is true, browsers reject wildcard '*' for Access-Control-Allow-Origin.
                // For wildcard patterns (like "https://*.example.com"), always use a matcher function.
                // For exact origins, we can pass them directly as string/array.
                if (configuredOrigin === '*' && credentials) {
                    // Credentials mode with '*' - reflect the request origin
                    origin = (requestOrigin: string) => requestOrigin || '*';
                } else if (hasWildcardPattern(configuredOrigin)) {
                    // Wildcard patterns (including better-auth style patterns like "https://*.objectui.org")
                    // Use pattern matcher to support subdomain and port wildcards
                    origin = createOriginMatcher(configuredOrigin);
                } else {
                    // Exact origin(s) — wrap in a function so localhost is
                    // still auto-allowed via the matcher.
                    const matcher = createOriginMatcher(configuredOrigin);
                    origin = (requestOrigin: string) => matcher(requestOrigin);
                }

                const rawApp = this.server.getRawApp();
                // Always include `set-auth-token` in exposed headers so that
                // the better-auth `bearer()` plugin can deliver rotated
                // session tokens to cross-origin clients (see plugin-auth).
                // User-supplied exposeHeaders are merged with this default.
                const defaultAllowHeaders = ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Tenant-ID'];
                const defaultExposeHeaders = ['set-auth-token'];
                const allowHeaders = corsOpts.allowHeaders ?? defaultAllowHeaders;
                const exposeHeaders = Array.from(new Set([
                    ...defaultExposeHeaders,
                    ...(corsOpts.exposeHeaders ?? []),
                ]));

                rawApp.use('*', cors({
                    origin: origin as any,
                    allowMethods: corsOpts.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
                    allowHeaders,
                    exposeHeaders,
                    credentials,
                    maxAge,
                }));

                ctx.logger.debug('CORS middleware enabled', { origin: configuredOrigin, credentials });
            }
        }
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

        // Catch-all: ensure unmatched requests always get a proper Response
        // (prevents Hono "Context is not finalized" error)
        const rawAppForNotFound = this.server.getRawApp();
        if (typeof rawAppForNotFound.notFound === 'function') {
            rawAppForNotFound.notFound((c: any) => c.json({ error: 'Not found' }, 404));
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
            if (actualPort !== port) {
                ctx.logger.warn(`Port ${port} is in use, using port ${actualPort} instead`);
            }
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
        rawApp.get('/.well-known/objectstack', (c: any) => c.redirect(`${prefix}/discovery`));
        rawApp.get(`${prefix}/discovery`, (c: any) => c.json({ data: discovery }));

        ctx.logger.info('Registered discovery endpoints', { prefix });

        // Basic CRUD data endpoints — delegate to ObjectQL service directly
        const getObjectQL = () => ctx.getService<IDataEngine>('objectql');

        // Create
        rawApp.post(`${prefix}/data/:object`, async (c: any) => {
            const ql = getObjectQL();
            if (!ql) return c.json({ error: 'Data service not available' }, 503);
            const object = c.req.param('object');
            const data = await c.req.json().catch(() => ({}));
            const res = await ql.insert(object, data);
            const record = { ...data, ...res };
            return c.json({ object, id: record.id, record });
        });

        // Get by ID
        rawApp.get(`${prefix}/data/:object/:id`, async (c: any) => {
            const ql = getObjectQL();
            if (!ql) return c.json({ error: 'Data service not available' }, 503);
            const object = c.req.param('object');
            const id = c.req.param('id');
            let all = await ql.find(object);
            if (!all) all = [];
            const match = all.find((i: any) => i.id === id);
            return match ? c.json({ object, id, record: match }) : c.json({ error: 'Not found' }, 404);
        });

        // Find / List
        rawApp.get(`${prefix}/data/:object`, async (c: any) => {
            const ql = getObjectQL();
            if (!ql) return c.json({ error: 'Data service not available' }, 503);
            const object = c.req.param('object');
            let all = await ql.find(object);
            if (!Array.isArray(all) && all && (all as any).value) all = (all as any).value;
            if (!all) all = [];
            return c.json({ object, records: all, total: all.length });
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
