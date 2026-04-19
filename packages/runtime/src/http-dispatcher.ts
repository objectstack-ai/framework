// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectKernel, getEnv, resolveLocale } from '@objectstack/core';
import { CoreServiceName } from '@objectstack/spec/system';
import { pluralToSingular } from '@objectstack/spec/shared';

/** Browser-safe UUID generator — prefers Web Crypto, falls back to RFC 4122 v4 */
function randomUUID(): string {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export interface HttpProtocolContext {
    request: any;
    response?: any;
}

export interface HttpDispatcherResult {
    handled: boolean;
    response?: {
        status: number;
        body?: any;
        headers?: Record<string, string>;
    };
    result?: any; // For flexible return types or direct response objects (Response/NextResponse)
}

/**
 * @deprecated Use `createDispatcherPlugin()` from `@objectstack/runtime` instead.
 * This class will be removed in v2. Prefer the plugin-based approach:
 * ```ts
 * import { createDispatcherPlugin } from '@objectstack/runtime';
 * kernel.use(createDispatcherPlugin({ prefix: '/api/v1' }));
 * ```
 */
export class HttpDispatcher {
    private kernel: any; // Casting to any to access dynamic props like services, graphql

    constructor(kernel: ObjectKernel) {
        this.kernel = kernel;
    }

    private success(data: any, meta?: any) {
        return {
            status: 200,
            body: { success: true, data, meta }
        };
    }

    private error(message: string, code: number = 500, details?: any) {
        return {
            status: code,
            body: { success: false, error: { message, code, details } }
        };
    }

    /**
     * 404 Route Not Found — no route is registered for this path.
     */
    private routeNotFound(route: string) {
        return {
            status: 404,
            body: {
                success: false,
                error: {
                    code: 404,
                    message: `Route Not Found: ${route}`,
                    type: 'ROUTE_NOT_FOUND' as const,
                    route,
                    hint: 'No route is registered for this path. Check the API discovery endpoint for available routes.',
                },
            },
        };
    }

    /**
     * Direct data service dispatch — replaces broker.call('data.*').
     * Tries protocol service first (supports expand/populate), falls back to ObjectQL.
     */
    private async callData(action: string, params: any): Promise<any> {
        const protocol = await this.resolveService('protocol');
        const qlService = await this.getObjectQLService();
        const ql = qlService ?? await this.resolveService('objectql');

        if (action === 'create') {
            if (ql) {
                const res = await ql.insert(params.object, params.data);
                const record = { ...params.data, ...res };
                return { object: params.object, id: record.id, record };
            }
            throw { statusCode: 503, message: 'Data service not available' };
        }

        if (action === 'get') {
            if (protocol && typeof protocol.getData === 'function') {
                return await protocol.getData({ object: params.object, id: params.id, expand: params.expand, select: params.select });
            }
            if (ql) {
                let all = await ql.find(params.object);
                if (!all) all = [];
                const match = all.find((i: any) => i.id === params.id);
                return match ? { object: params.object, id: params.id, record: match } : null;
            }
            throw { statusCode: 503, message: 'Data service not available' };
        }

        if (action === 'update') {
            if (ql && params.id) {
                let all = await ql.find(params.object);
                if (all && (all as any).value) all = (all as any).value;
                if (!all) all = [];
                const existing = all.find((i: any) => i.id === params.id);
                if (!existing) throw new Error('[ObjectStack] Not Found');
                await ql.update(params.object, params.data, { where: { id: params.id } });
                return { object: params.object, id: params.id, record: { ...existing, ...params.data } };
            }
            throw { statusCode: 503, message: 'Data service not available' };
        }

        if (action === 'delete') {
            if (ql) {
                await ql.delete(params.object, { where: { id: params.id } });
                return { object: params.object, id: params.id, deleted: true };
            }
            throw { statusCode: 503, message: 'Data service not available' };
        }

        if (action === 'query' || action === 'find') {
            if (protocol && typeof protocol.findData === 'function') {
                // Build query: use explicit params.query if provided, otherwise extract query fields from params
                const query = params.query || (() => {
                    const { object, ...rest } = params;
                    return rest;
                })();
                return await protocol.findData({ object: params.object, query });
            }
            if (ql) {
                let all = await ql.find(params.object);
                if (!Array.isArray(all) && all && (all as any).value) all = (all as any).value;
                if (!all) all = [];
                return { object: params.object, records: all, total: all.length };
            }
            throw { statusCode: 503, message: 'Data service not available' };
        }

        if (action === 'batch') {
            // Batch operations — not yet supported via direct service dispatch
            return { object: params.object, results: [] };
        }

        throw { statusCode: 400, message: `Unknown data action: ${action}` };
    }

    /**
     * Generates the discovery JSON response for the API root.
     *
     * Uses the same async `resolveService()` fallback chain that request
     * handlers use, so the reported service status is always consistent
     * with the actual runtime availability.
     */
    async getDiscoveryInfo(prefix: string) {
        // Resolve all services through the same async fallback chain
        // that request handlers (handleI18n, handleAuth, …) use.
        const [
            authSvc, graphqlSvc, searchSvc, realtimeSvc, filesSvc,
            analyticsSvc, workflowSvc, aiSvc, notificationSvc, i18nSvc,
            uiSvc, automationSvc, cacheSvc, queueSvc, jobSvc,
        ] = await Promise.all([
            this.resolveService(CoreServiceName.enum.auth),
            this.resolveService(CoreServiceName.enum.graphql),
            this.resolveService(CoreServiceName.enum.search),
            this.resolveService(CoreServiceName.enum.realtime),
            this.resolveService(CoreServiceName.enum['file-storage']),
            this.resolveService(CoreServiceName.enum.analytics),
            this.resolveService(CoreServiceName.enum.workflow),
            this.resolveService(CoreServiceName.enum.ai),
            this.resolveService(CoreServiceName.enum.notification),
            this.resolveService(CoreServiceName.enum.i18n),
            this.resolveService(CoreServiceName.enum.ui),
            this.resolveService(CoreServiceName.enum.automation),
            this.resolveService(CoreServiceName.enum.cache),
            this.resolveService(CoreServiceName.enum.queue),
            this.resolveService(CoreServiceName.enum.job),
        ]);

        const hasAuth         = !!authSvc;
        const hasGraphQL      = !!(graphqlSvc || this.kernel.graphql);
        const hasSearch       = !!searchSvc;
        const hasWebSockets   = !!realtimeSvc;
        const hasFiles        = !!filesSvc;
        const hasAnalytics    = !!analyticsSvc;
        const hasWorkflow     = !!workflowSvc;
        const hasAi           = !!aiSvc;
        const hasNotification = !!notificationSvc;
        const hasI18n         = !!i18nSvc;
        const hasUi           = !!uiSvc;
        const hasAutomation   = !!automationSvc;
        const hasCache        = !!cacheSvc;
        const hasQueue        = !!queueSvc;
        const hasJob          = !!jobSvc;

        // Routes are only exposed when a plugin provides the service
        const routes = {
                data:          `${prefix}/data`,
                metadata:      `${prefix}/meta`,
                packages:      `${prefix}/packages`,
                auth:          hasAuth ? `${prefix}/auth` : undefined,
                ui:            hasUi ? `${prefix}/ui` : undefined,
                graphql:       hasGraphQL ? `${prefix}/graphql` : undefined,
                storage:       hasFiles ? `${prefix}/storage` : undefined,
                analytics:     hasAnalytics ? `${prefix}/analytics` : undefined,
                automation:    hasAutomation ? `${prefix}/automation` : undefined,
                workflow:      hasWorkflow ? `${prefix}/workflow` : undefined,
                realtime:      hasWebSockets ? `${prefix}/realtime` : undefined,
                notifications: hasNotification ? `${prefix}/notifications` : undefined,
                ai:            hasAi ? `${prefix}/ai` : undefined,
                i18n:          hasI18n ? `${prefix}/i18n` : undefined,
        };

        // Build per-service status map
        // handlerReady: true means the dispatcher has a real, bound handler for this route.
        // handlerReady: false means the route is present in the discovery table but may not
        // yet have a concrete implementation or may be served by a stub.
        const svcAvailable = (route?: string, provider?: string) => ({
            enabled: true, status: 'available' as const, handlerReady: true, route, provider,
        });
        const svcUnavailable = (name: string) => ({
            enabled: false, status: 'unavailable' as const, handlerReady: false,
            message: `Install a ${name} plugin to enable`,
        });

        // Derive locale info from actual i18n service when available
        let locale = { default: 'en', supported: ['en'], timezone: 'UTC' };
        if (hasI18n && i18nSvc) {
            const defaultLocale = typeof i18nSvc.getDefaultLocale === 'function'
                ? i18nSvc.getDefaultLocale() : 'en';
            const locales = typeof i18nSvc.getLocales === 'function'
                ? i18nSvc.getLocales() : [];
            locale = {
                default: defaultLocale,
                supported: locales.length > 0 ? locales : [defaultLocale],
                timezone: 'UTC',
            };
        }

        return {
            name: 'ObjectOS',
            version: '1.0.0',
            environment: getEnv('NODE_ENV', 'development'),
            routes,
            endpoints: routes, // Alias for backward compatibility with some clients
            features: {
                graphql: hasGraphQL,
                search: hasSearch,
                websockets: hasWebSockets,
                files: hasFiles,
                analytics: hasAnalytics,
                ai: hasAi,
                workflow: hasWorkflow,
                notifications: hasNotification,
                i18n: hasI18n,
            },
            services: {
                // Kernel-provided (always available via protocol implementation)
                metadata:       { enabled: true, status: 'degraded' as const, handlerReady: true, route: routes.metadata, provider: 'kernel', message: 'In-memory registry; DB persistence pending' },
                data:           svcAvailable(routes.data, 'kernel'),
                // Plugin-provided — only available when a plugin registers the service
                auth:           hasAuth ? svcAvailable(routes.auth) : svcUnavailable('auth'),
                automation:     hasAutomation ? svcAvailable(routes.automation) : svcUnavailable('automation'),
                analytics:      hasAnalytics ? svcAvailable(routes.analytics) : svcUnavailable('analytics'),
                cache:          hasCache ? svcAvailable() : svcUnavailable('cache'),
                queue:          hasQueue ? svcAvailable() : svcUnavailable('queue'),
                job:            hasJob ? svcAvailable() : svcUnavailable('job'),
                ui:             hasUi ? svcAvailable(routes.ui) : svcUnavailable('ui'),
                workflow:       hasWorkflow ? svcAvailable(routes.workflow) : svcUnavailable('workflow'),
                realtime:       hasWebSockets ? svcAvailable(routes.realtime) : svcUnavailable('realtime'),
                notification:   hasNotification ? svcAvailable(routes.notifications) : svcUnavailable('notification'),
                ai:             hasAi ? svcAvailable(routes.ai) : svcUnavailable('ai'),
                i18n:           hasI18n ? svcAvailable(routes.i18n) : svcUnavailable('i18n'),
                graphql:        hasGraphQL ? svcAvailable(routes.graphql) : svcUnavailable('graphql'),
                'file-storage': hasFiles ? svcAvailable(routes.storage) : svcUnavailable('file-storage'),
                search:         hasSearch ? svcAvailable() : svcUnavailable('search'),
            },
            locale,
        };
    }

    /**
     * Handles GraphQL requests
     */
    async handleGraphQL(body: { query: string; variables?: any }, context: HttpProtocolContext) {
        if (!body || !body.query) {
             throw { statusCode: 400, message: 'Missing query in request body' };
        }
        
        if (typeof this.kernel.graphql !== 'function') {
            throw { statusCode: 501, message: 'GraphQL service not available' };
        }

        return this.kernel.graphql(body.query, body.variables, { 
            request: context.request 
        });
    }

    /**
     * Handles Auth requests
     * path: sub-path after /auth/
     */
    async handleAuth(path: string, method: string, body: any, context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        // 1. Try generic Auth Service
        const authService = await this.getService(CoreServiceName.enum.auth);
        if (authService && typeof authService.handler === 'function') {
            const response = await authService.handler(context.request, context.response);
            return { handled: true, result: response };
        }

        // 2. Mock fallback for MSW/test environments when no auth service is registered
        const normalizedPath = path.replace(/^\/+/, '');
        return this.mockAuthFallback(normalizedPath, method, body);
    }

    /**
     * Provides mock auth responses for core better-auth endpoints when
     * AuthPlugin is not loaded (e.g. MSW/browser-only environments).
     * This ensures registration/sign-in flows do not 404 in mock mode.
     */
    private mockAuthFallback(path: string, method: string, body: any): HttpDispatcherResult {
        const m = method.toUpperCase();
        const MOCK_SESSION_EXPIRY_MS = 86_400_000; // 24 hours

        // POST sign-up/email
        if ((path === 'sign-up/email' || path === 'register') && m === 'POST') {
            const id = `mock_${randomUUID()}`;
            return {
                handled: true,
                response: {
                    status: 200,
                    body: {
                        user: { id, name: body?.name || 'Mock User', email: body?.email || 'mock@test.local', emailVerified: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                        session: { id: `session_${id}`, userId: id, token: `mock_token_${id}`, expiresAt: new Date(Date.now() + MOCK_SESSION_EXPIRY_MS).toISOString() },
                    },
                },
            };
        }

        // POST sign-in/email or login
        if ((path === 'sign-in/email' || path === 'login') && m === 'POST') {
            const id = `mock_${randomUUID()}`;
            return {
                handled: true,
                response: {
                    status: 200,
                    body: {
                        user: { id, name: 'Mock User', email: body?.email || 'mock@test.local', emailVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                        session: { id: `session_${id}`, userId: id, token: `mock_token_${id}`, expiresAt: new Date(Date.now() + MOCK_SESSION_EXPIRY_MS).toISOString() },
                    },
                },
            };
        }

        // GET get-session
        if (path === 'get-session' && m === 'GET') {
            return {
                handled: true,
                response: { status: 200, body: { session: null, user: null } },
            };
        }

        // POST sign-out
        if (path === 'sign-out' && m === 'POST') {
            return {
                handled: true,
                response: { status: 200, body: { success: true } },
            };
        }

        return { handled: false };
    }

    /**
     * Handles Metadata requests
     * Standard: /metadata/:type/:name
     * Fallback for backward compat: /metadata (all objects), /metadata/:objectName (get object)
     */
    async handleMetadata(path: string, _context: HttpProtocolContext, method?: string, body?: any, query?: any): Promise<HttpDispatcherResult> {
        const parts = path.replace(/^\/+/, '').split('/').filter(Boolean);
        
        // GET /metadata/types
        if (parts[0] === 'types') {
            // PRIORITY 1: Try MetadataService directly (includes both typeRegistry with agent/tool AND runtime-registered types)
            const metadataService = await this.resolveService('metadata');

            if (metadataService && typeof (metadataService as any).getRegisteredTypes === 'function') {
                try {
                    const types = await (metadataService as any).getRegisteredTypes();
                    return { handled: true, response: this.success({ types }) };
                } catch (e: any) {
                    // Log error but continue to fallbacks
                    console.warn('[HttpDispatcher] MetadataService.getRegisteredTypes() failed:', e.message);
                }
            }
            // PRIORITY 2: Try protocol service (returns SchemaRegistry types only - missing agent/tool)
            const protocol = await this.resolveService('protocol');
            if (protocol && typeof protocol.getMetaTypes === 'function') {
                const result = await protocol.getMetaTypes({});
                return { handled: true, response: this.success(result) };
            }
            // Last resort: hardcoded defaults
            return { handled: true, response: this.success({ types: ['object', 'app', 'plugin'] }) };
        }

        // GET /metadata/:type/:name/published → get published version
        if (parts.length === 3 && parts[2] === 'published' && (!method || method === 'GET')) {
            const [type, name] = parts;
            const metadataService = await this.getService(CoreServiceName.enum.metadata);
            if (metadataService && typeof (metadataService as any).getPublished === 'function') {
                const data = await (metadataService as any).getPublished(type, name);
                if (data === undefined) return { handled: true, response: this.error('Not found', 404) };
                return { handled: true, response: this.success(data) };
            }
            // Fallback — try MetadataService via resolveService
            const metaSvc = await this.resolveService('metadata');
            if (metaSvc && typeof (metaSvc as any).getPublished === 'function') {
                try {
                    const fallbackData = await (metaSvc as any).getPublished(type, name);
                    if (fallbackData !== undefined) return { handled: true, response: this.success(fallbackData) };
                } catch { /* fall through */ }
            }
            return { handled: true, response: this.error('Not found', 404) };
        }

        // /metadata/:type/:name
        if (parts.length === 2) {
            const [type, name] = parts;
            // Extract optional package filter from query string
            const packageId = query?.package || undefined;

            // PUT /metadata/:type/:name (Save)
            if (method === 'PUT' && body) {
                // Try to get the protocol service directly
                const protocol = await this.resolveService('protocol');

                if (protocol && typeof protocol.saveMetaItem === 'function') {
                    try {
                        const result = await protocol.saveMetaItem({ type, name, item: body });
                        return { handled: true, response: this.success(result) };
                    } catch (e: any) {
                        return { handled: true, response: this.error(e.message, 400) };
                    }
                }

                // Fallback: try MetadataService directly
                const metaSvc = await this.resolveService('metadata');
                if (metaSvc && typeof (metaSvc as any).saveItem === 'function') {
                    try {
                        const data = await (metaSvc as any).saveItem(type, name, body);
                        return { handled: true, response: this.success(data) };
                    } catch (e: any) {
                        return { handled: true, response: this.error(e.message || 'Save not supported', 501) };
                    }
                }
                return { handled: true, response: this.error('Save not supported', 501) };
            }

            try {
                // Try specific calls based on type
                if (type === 'objects' || type === 'object') {
                    // Try ObjectQL service directly
                    const qlService = await this.getObjectQLService();
                    if (qlService?.registry) {
                        const data = qlService.registry.getObject(name);
                        if (data) return { handled: true, response: this.success(data) };
                    }
                    return { handled: true, response: this.error('Not found', 404) };
                }

                // Normalize plural URL paths to singular registry type names
                const singularType = pluralToSingular(type);

                // Try Protocol Service First (Preferred)
                const protocol = await this.resolveService('protocol');
                if (protocol && typeof protocol.getMetaItem === 'function') {
                     try {
                        const data = await protocol.getMetaItem({ type: singularType, name, packageId });
                        return { handled: true, response: this.success(data) };
                     } catch (e: any) {
                        // Protocol might throw if not found or not supported
                     }
                }

                // Try MetadataService for runtime-registered types
                const metaSvc = await this.resolveService('metadata');
                if (metaSvc && typeof (metaSvc as any).getItem === 'function') {
                    try {
                        const data = await (metaSvc as any).getItem(singularType, name);
                        if (data) return { handled: true, response: this.success(data) };
                    } catch { /* not found */ }
                }
                return { handled: true, response: this.error('Not found', 404) };
            } catch (e: any) {
                // Fallback: treat first part as object name if only 1 part (handled below)
                // But here we are deep in 2 parts. Must be an error.
                return { handled: true, response: this.error(e.message, 404) };
            }
        }
        
        // GET /metadata/:type (List items of type) OR /metadata/:objectName (Legacy)
        if (parts.length === 1) {
            const typeOrName = parts[0];
            // Extract optional package filter from query string
            const packageId = query?.package || undefined;

            // Try protocol service first for any type
            const protocol = await this.resolveService('protocol');
            if (protocol && typeof protocol.getMetaItems === 'function') {
                try {
                    const data = await protocol.getMetaItems({ type: typeOrName, packageId });
                    // Return any valid response from protocol (including empty items arrays)
                    if (data && (data.items !== undefined || Array.isArray(data))) {
                        return { handled: true, response: this.success(data) };
                    }
                } catch {
                    // Protocol doesn't know this type, fall through
                }
            }

            // Try MetadataService directly for runtime-registered metadata (agents, tools, etc.)
            const metadataService = await this.getService(CoreServiceName.enum.metadata);
            if (metadataService && typeof (metadataService as any).list === 'function') {
                try {
                    let items = await (metadataService as any).list(typeOrName);
                    // Respect package filter: MetadataService.list() returns ALL items,
                    // so filter by _packageId when a specific package is requested.
                    if (packageId && items && items.length > 0) {
                        items = items.filter((item: any) => item?._packageId === packageId);
                    }
                    if (items && items.length > 0) {
                        return { handled: true, response: this.success({ type: typeOrName, items }) };
                    }
                } catch (e: any) {
                    // MetadataService doesn't know this type or failed, continue to other fallbacks
                    // Sanitize typeOrName to prevent log injection (CodeQL warning)
                    const sanitizedType = String(typeOrName).replace(/[\r\n\t]/g, '');
                    console.debug(`[HttpDispatcher] MetadataService.list() failed for type:`, sanitizedType, 'error:', e.message);
                }
            }

            // Try ObjectQL registry directly for object/type lookups
            const qlService = await this.getObjectQLService();
            if (qlService?.registry) {
                if (typeOrName === 'objects') {
                    const objs = qlService.registry.getAllObjects(packageId);
                    return { handled: true, response: this.success({ type: 'object', items: objs }) };
                }
                // Try listing items of the given type
                const items = qlService.registry.listItems?.(typeOrName, packageId);
                if (items && items.length > 0) {
                    return { handled: true, response: this.success({ type: typeOrName, items }) };
                }
                // Legacy: treat as object name
                const obj = qlService.registry.getObject(typeOrName);
                if (obj) return { handled: true, response: this.success(obj) };
            }
            return { handled: true, response: this.error('Not found', 404) };
        }

        // GET /metadata — return available metadata types
        if (parts.length === 0) {
            // Try MetadataService for registered types
            const metadataService = await this.resolveService('metadata');
            if (metadataService && typeof (metadataService as any).getRegisteredTypes === 'function') {
                try {
                    const types = await (metadataService as any).getRegisteredTypes();
                    return { handled: true, response: this.success({ types }) };
                } catch { /* fall through */ }
            }
            // Try protocol service for dynamic types
            const protocol = await this.resolveService('protocol');
            if (protocol && typeof protocol.getMetaTypes === 'function') {
                const result = await protocol.getMetaTypes({});
                return { handled: true, response: this.success(result) };
            }
            return { handled: true, response: this.success({ types: ['object', 'app', 'plugin'] }) };
        }
        
        return { handled: false };
    }

    /**
     * Handles Data requests
     * path: sub-path after /data/ (e.g. "contacts", "contacts/123", "contacts/query")
     */
    async handleData(path: string, method: string, body: any, query: any, _context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        const parts = path.replace(/^\/+/, '').split('/');
        const objectName = parts[0];
        
        if (!objectName) {
            return { handled: true, response: this.error('Object name required', 400) };
        }

        const m = method.toUpperCase();

        // 1. Custom Actions (query, batch)
        if (parts.length > 1) {
            const action = parts[1];
            
            // POST /data/:object/query
            if (action === 'query' && m === 'POST') {
                // Spec: returns FindDataResponse = { object, records, total?, hasMore? }
                const result = await this.callData('query', { object: objectName, ...body });
                return { handled: true, response: this.success(result) };
            }

            // POST /data/:object/batch
            if (action === 'batch' && m === 'POST') {
                const result = await this.callData('batch', { object: objectName, ...body });
                return { handled: true, response: this.success(result) };
            }

            // GET /data/:object/:id
            if (parts.length === 2 && m === 'GET') {
                const id = parts[1];
                // Spec: Only select/expand are allowlisted query params for GET by ID.
                // All other query parameters are discarded to prevent parameter pollution.
                const { select, expand } = query || {};
                const allowedParams: Record<string, unknown> = {};
                if (select != null) allowedParams.select = select;
                if (expand != null) allowedParams.expand = expand;
                // Spec: returns GetDataResponse = { object, id, record }
                const result = await this.callData('get', { object: objectName, id, ...allowedParams });
                return { handled: true, response: this.success(result) };
            }

            // PATCH /data/:object/:id
            if (parts.length === 2 && m === 'PATCH') {
                const id = parts[1];
                // Spec: returns UpdateDataResponse = { object, id, record }
                const result = await this.callData('update', { object: objectName, id, data: body });
                return { handled: true, response: this.success(result) };
            }

            // DELETE /data/:object/:id
            if (parts.length === 2 && m === 'DELETE') {
                const id = parts[1];
                // Spec: returns DeleteDataResponse = { object, id, deleted }
                const result = await this.callData('delete', { object: objectName, id });
                return { handled: true, response: this.success(result) };
            }
        } else {
            // GET /data/:object (List)
            if (m === 'GET') {
                // ── Normalize HTTP transport params → Spec canonical (QueryAST) ──
                // HTTP GET query params use transport-level names (filter, sort, top,
                // skip, select, expand) which are normalized here to canonical
                // QueryAST field names (where, orderBy, limit, offset, fields,
                // expand) before forwarding to the data service layer.
                // The protocol.ts findData() method performs a deeper normalization
                // pass, but pre-normalizing here ensures the data service always receives
                // Spec-canonical keys.
                const normalized: Record<string, unknown> = { ...query };

                // filter/filters → where
                // Note: `filter` is the canonical HTTP *transport* parameter name
                // (see HttpFindQueryParamsSchema). It is normalized here to the
                // canonical *QueryAST* field name `where` before data dispatch.
                // `filters` (plural) is a deprecated alias for `filter`.
                if (normalized.filter != null || normalized.filters != null) {
                    normalized.where = normalized.where ?? normalized.filter ?? normalized.filters;
                    delete normalized.filter;
                    delete normalized.filters;
                }
                // select → fields
                if (normalized.select != null && normalized.fields == null) {
                    normalized.fields = normalized.select;
                    delete normalized.select;
                }
                // sort → orderBy
                if (normalized.sort != null && normalized.orderBy == null) {
                    normalized.orderBy = normalized.sort;
                    delete normalized.sort;
                }
                // top → limit
                if (normalized.top != null && normalized.limit == null) {
                    normalized.limit = normalized.top;
                    delete normalized.top;
                }
                // skip → offset
                if (normalized.skip != null && normalized.offset == null) {
                    normalized.offset = normalized.skip;
                    delete normalized.skip;
                }

                // Spec: returns FindDataResponse = { object, records, total?, hasMore? }
                const result = await this.callData('query', { object: objectName, query: normalized });
                return { handled: true, response: this.success(result) };
            }

            // POST /data/:object (Create)
            if (m === 'POST') {
                // Spec: returns CreateDataResponse = { object, id, record }
                const result = await this.callData('create', { object: objectName, data: body });
                const res = this.success(result);
                res.status = 201;
                return { handled: true, response: res };
            }
        }
        
        return { handled: false };
    }

    /**
     * Handles Analytics requests
     * path: sub-path after /analytics/
     */
    async handleAnalytics(path: string, method: string, body: any, _context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        const analyticsService = await this.getService(CoreServiceName.enum.analytics);
        if (!analyticsService) return { handled: false }; // 404 handled by caller if unhandled

        const m = method.toUpperCase();
        const subPath = path.replace(/^\/+/, '');

        // POST /analytics/query
        if (subPath === 'query' && m === 'POST') {
            const result = await analyticsService.query(body);
            return { handled: true, response: this.success(result) };
        }

        // GET /analytics/meta
        if (subPath === 'meta' && m === 'GET') {
            const result = await analyticsService.getMeta();
             return { handled: true, response: this.success(result) };
        }

        // POST /analytics/sql (Dry-run or debug)
        if (subPath === 'sql' && m === 'POST') {
             // Assuming service has generateSql method
             const result = await analyticsService.generateSql(body);
             return { handled: true, response: this.success(result) };
        }

        return { handled: false };
    }

    /**
     * Handles i18n requests
     * path: sub-path after /i18n/
     *
     * Routes:
     *   GET /locales                    → getLocales
     *   GET /translations/:locale       → getTranslations (locale from path)
     *   GET /translations?locale=xx     → getTranslations (locale from query)
     *   GET /labels/:object/:locale     → getFieldLabels  (both from path)
     *   GET /labels/:object?locale=xx   → getFieldLabels  (locale from query)
     */
    async handleI18n(path: string, method: string, query: any, _context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        const i18nService = await this.getService(CoreServiceName.enum.i18n);
        if (!i18nService) return { handled: true, response: this.error('i18n service not available', 501) };

        const m = method.toUpperCase();
        const parts = path.replace(/^\/+/, '').split('/').filter(Boolean);

        if (m !== 'GET') return { handled: false };

        // GET /i18n/locales
        if (parts[0] === 'locales' && parts.length === 1) {
            const locales = i18nService.getLocales();
            return { handled: true, response: this.success({ locales }) };
        }

        // GET /i18n/translations/:locale  OR  /i18n/translations?locale=xx
        if (parts[0] === 'translations') {
            const locale = parts[1] ? decodeURIComponent(parts[1]) : query?.locale;
            if (!locale) return { handled: true, response: this.error('Missing locale parameter', 400) };

            let translations = i18nService.getTranslations(locale);

            // Locale fallback: try resolving to an available locale when
            // the exact code yields empty translations (e.g. zh → zh-CN).
            if (Object.keys(translations).length === 0) {
                const availableLocales = typeof i18nService.getLocales === 'function'
                    ? i18nService.getLocales() : [];
                const resolved = resolveLocale(locale, availableLocales);
                if (resolved && resolved !== locale) {
                    translations = i18nService.getTranslations(resolved);
                    return { handled: true, response: this.success({ locale: resolved, requestedLocale: locale, translations }) };
                }
            }

            return { handled: true, response: this.success({ locale, translations }) };
        }

        // GET /i18n/labels/:object/:locale  OR  /i18n/labels/:object?locale=xx
        if (parts[0] === 'labels' && parts.length >= 2) {
            const objectName = decodeURIComponent(parts[1]);
            let locale = parts[2] ? decodeURIComponent(parts[2]) : query?.locale;
            if (!locale) return { handled: true, response: this.error('Missing locale parameter', 400) };

            // Locale fallback for labels endpoint
            const availableLocales = typeof i18nService.getLocales === 'function'
                ? i18nService.getLocales() : [];
            const resolved = resolveLocale(locale, availableLocales);
            if (resolved) locale = resolved;

            if (typeof i18nService.getFieldLabels === 'function') {
                const labels = i18nService.getFieldLabels(objectName, locale);
                return { handled: true, response: this.success({ object: objectName, locale, labels }) };
            }
            // Fallback: derive field labels from full translation bundle
            const translations = i18nService.getTranslations(locale);
            const prefix = `o.${objectName}.fields.`;
            const labels: Record<string, string> = {};
            for (const [key, value] of Object.entries(translations)) {
                if (key.startsWith(prefix)) {
                    labels[key.substring(prefix.length)] = value as string;
                }
            }
            return { handled: true, response: this.success({ object: objectName, locale, labels }) };
        }

        return { handled: false };
    }

    /**
     * Handles Package Management requests
     * 
     * REST Endpoints:
     * - GET    /packages          → list all installed packages
     * - GET    /packages/:id      → get a specific package
     * - POST   /packages          → install a new package
     * - DELETE  /packages/:id      → uninstall a package
     * - PATCH  /packages/:id/enable  → enable a package
     * - PATCH  /packages/:id/disable → disable a package
     * - POST   /packages/:id/publish → publish a package (metadata snapshot)
     * - POST   /packages/:id/revert  → revert a package to last published state
     * 
     * Uses ObjectQL SchemaRegistry directly (via the 'objectql' service).
     */
    async handlePackages(path: string, method: string, body: any, query: any, _context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        const m = method.toUpperCase();
        const parts = path.replace(/^\/+/, '').split('/').filter(Boolean);

        // Try to get SchemaRegistry from the ObjectQL service
        const qlService = await this.getObjectQLService();
        const registry = qlService?.registry;

        // If no registry available, return 503
        if (!registry) {
            return { handled: true, response: this.error('Package service not available', 503) };
        }

        try {
            // GET /packages → list packages
            if (parts.length === 0 && m === 'GET') {
                let packages = registry.getAllPackages();
                // Apply optional filters
                if (query?.status) {
                    packages = packages.filter((p: any) => p.status === query.status);
                }
                if (query?.type) {
                    packages = packages.filter((p: any) => p.manifest?.type === query.type);
                }
                return { handled: true, response: this.success({ packages, total: packages.length }) };
            }

            // POST /packages → install package
            if (parts.length === 0 && m === 'POST') {
                const pkg = registry.installPackage(body.manifest || body, body.settings);
                const res = this.success(pkg);
                res.status = 201;
                return { handled: true, response: res };
            }

            // PATCH /packages/:id/enable
            if (parts.length === 2 && parts[1] === 'enable' && m === 'PATCH') {
                const id = decodeURIComponent(parts[0]);
                const pkg = registry.enablePackage(id);
                if (!pkg) return { handled: true, response: this.error(`Package '${id}' not found`, 404) };
                return { handled: true, response: this.success(pkg) };
            }

            // PATCH /packages/:id/disable
            if (parts.length === 2 && parts[1] === 'disable' && m === 'PATCH') {
                const id = decodeURIComponent(parts[0]);
                const pkg = registry.disablePackage(id);
                if (!pkg) return { handled: true, response: this.error(`Package '${id}' not found`, 404) };
                return { handled: true, response: this.success(pkg) };
            }

            // POST /packages/:id/publish → publish package metadata
            if (parts.length === 2 && parts[1] === 'publish' && m === 'POST') {
                const id = decodeURIComponent(parts[0]);
                const metadataService = await this.getService(CoreServiceName.enum.metadata);
                if (metadataService && typeof (metadataService as any).publishPackage === 'function') {
                    const result = await (metadataService as any).publishPackage(id, body || {});
                    return { handled: true, response: this.success(result) };
                }
                return { handled: true, response: this.error('Metadata service not available', 503) };
            }

            // POST /packages/:id/revert → revert package to last published state
            if (parts.length === 2 && parts[1] === 'revert' && m === 'POST') {
                const id = decodeURIComponent(parts[0]);
                const metadataService = await this.getService(CoreServiceName.enum.metadata);
                if (metadataService && typeof (metadataService as any).revertPackage === 'function') {
                    await (metadataService as any).revertPackage(id);
                    return { handled: true, response: this.success({ success: true }) };
                }
                return { handled: true, response: this.error('Metadata service not available', 503) };
            }

            // GET /packages/:id → get package
            if (parts.length === 1 && m === 'GET') {
                const id = decodeURIComponent(parts[0]);
                const pkg = registry.getPackage(id);
                if (!pkg) return { handled: true, response: this.error(`Package '${id}' not found`, 404) };
                return { handled: true, response: this.success(pkg) };
            }

            // DELETE /packages/:id → uninstall package
            if (parts.length === 1 && m === 'DELETE') {
                const id = decodeURIComponent(parts[0]);
                const success = registry.uninstallPackage(id);
                if (!success) return { handled: true, response: this.error(`Package '${id}' not found`, 404) };
                return { handled: true, response: this.success({ success: true }) };
            }
        } catch (e: any) {
            return { handled: true, response: this.error(e.message, e.statusCode || 500) };
        }

        return { handled: false };
    }

    /**
     * Cloud / Environment Control-Plane routes.
     *
     *  - GET    /cloud/drivers                                 → list registered ObjectQL drivers (for env provisioning)
     *  - GET    /cloud/environments                            → list
     *  - POST   /cloud/environments                            → provision (driver: memory | turso | <any registered driver>)
     *  - GET    /cloud/environments/:id                        → detail (+ db, credential, membership)
     *  - PATCH  /cloud/environments/:id                        → update displayName / plan / status / isDefault / metadata
     *  - POST   /cloud/environments/:id/activate               → mark as active for session (stub)
     *  - POST   /cloud/environments/:id/credentials/rotate     → rotate credential
     *  - GET    /cloud/environments/:id/members                → list members
     *  - GET    /cloud/environments/:id/packages               → list installed packages
     *  - POST   /cloud/environments/:id/packages               → install package into env
     *  - GET    /cloud/environments/:id/packages/:pkgId        → get installation detail
     *  - PATCH  /cloud/environments/:id/packages/:pkgId/enable  → enable package
     *  - PATCH  /cloud/environments/:id/packages/:pkgId/disable → disable package
     *  - DELETE /cloud/environments/:id/packages/:pkgId        → uninstall (scope=platform forbidden)
     *  - POST   /cloud/environments/:id/packages/:pkgId/upgrade → upgrade to newer version
     *
     * Driver binding
     * --------------
     * Environments are not tied to any specific driver. At provisioning time the
     * caller passes `driver` (a short name such as `memory`, `turso`, or any
     * future `sql` / `postgres` driver). The dispatcher validates the name
     * against the kernel's registered driver services (`driver.<name>`) and
     * derives an appropriate placeholder `database_url` for the chosen driver.
     * If `driver` is omitted, the dispatcher auto-selects the first available
     * in preference order: turso → memory → any other registered driver.
     *
     * Backed by ObjectQL sys__environment / sys__environment_database /
     * sys__database_credential / sys__environment_member tables (registered
     * by `@objectstack/service-tenant`'s `createTenantPlugin`).
     */
    async handleCloud(path: string, method: string, body: any, query: any, _context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        const m = method.toUpperCase();
        const parts = path.replace(/^\/+/, '').split('/').filter(Boolean);

        const qlService = await this.getObjectQLService();
        const ql = qlService ?? await this.resolveService('objectql');
        if (!ql) {
            return { handled: true, response: this.error('Environment service not available (ObjectQL missing)', 503) };
        }

        const ENV = 'sys__environment';
        const DB = 'sys__environment_database';
        const CRED = 'sys__database_credential';
        const MEM = 'sys__environment_member';
        const PKG_INSTALL = 'sys__package_installation';

        // Enumerate registered ObjectQL drivers. Driver services are registered
        // by `DriverPlugin` under the key `driver.<driver.name>` where
        // `driver.name` is typically the full FQN like `com.objectstack.driver.memory`.
        // We derive a short name by stripping the `com.objectstack.driver.` prefix.
        const toShortName = (driverId: string): string => {
            const prefix = 'com.objectstack.driver.';
            return driverId.startsWith(prefix) ? driverId.slice(prefix.length) : driverId;
        };
        const listRegisteredDrivers = (): Array<{ name: string; driverId: string }> => {
            const services = this.getServicesMap();
            const drivers: Array<{ name: string; driverId: string }> = [];
            for (const [serviceKey, svc] of Object.entries(services)) {
                if (!serviceKey.startsWith('driver.')) continue;
                const raw = serviceKey.slice('driver.'.length);
                if (!raw || raw === 'unknown') continue;
                const driverId = (svc as any)?.name ?? raw;
                drivers.push({ name: toShortName(driverId), driverId });
            }
            return drivers;
        };

        const resolveDriver = (requested: string | undefined): { name: string; driverId: string } | undefined => {
            const registered = listRegisteredDrivers();
            if (requested) {
                const wanted = String(requested).toLowerCase();
                return registered.find((d) => d.name === wanted || d.driverId === wanted);
            }
            // Auto-pick: prefer turso, then memory, then whatever is available.
            return (
                registered.find((d) => d.name === 'turso') ??
                registered.find((d) => d.name === 'memory') ??
                registered[0]
            );
        };

        const buildDatabaseUrl = (driverName: string, environmentId: string): string => {
            const dbName = `env-${environmentId}`;
            switch (driverName) {
                case 'memory':
                    return `memory://${dbName}`;
                case 'turso':
                    return `libsql://${dbName}.mock-turso.local`;
                default:
                    // Generic placeholder for future SQL / postgres / mysql drivers.
                    return `${driverName}://${dbName}`;
            }
        };

        const findOne = async (obj: string, where: Record<string, unknown>): Promise<any | undefined> => {
            let rows = await ql.find(obj, { where } as any);
            if (rows && (rows as any).value) rows = (rows as any).value;
            if (!Array.isArray(rows)) return undefined;
            return rows[0];
        };

        try {
            // ----- /cloud/drivers ------------------------------------------
            if (parts.length === 1 && parts[0] === 'drivers' && m === 'GET') {
                const drivers = listRegisteredDrivers();
                return { handled: true, response: this.success({ drivers, total: drivers.length }) };
            }

            // ----- /cloud/environments collection routes -----
            if (parts.length === 1 && parts[0] === 'environments' && m === 'GET') {
                const where: Record<string, unknown> = {};
                if (query?.organizationId) where.organization_id = query.organizationId;
                if (query?.envType) where.env_type = query.envType;
                if (query?.status) where.status = query.status;
                let rows = await ql.find(ENV, Object.keys(where).length ? ({ where } as any) : undefined);
                if (rows && (rows as any).value) rows = (rows as any).value;
                const environments = Array.isArray(rows) ? rows : [];
                return { handled: true, response: this.success({ environments, total: environments.length }) };
            }

            if (parts.length === 1 && parts[0] === 'environments' && m === 'POST') {
                const req = body || {};
                // Resolve `__session__` placeholders from the active session so clients
                // can omit these fields and let the server infer them.
                if (req.organizationId === '__session__' || req.createdBy === '__session__') {
                    try {
                        const authService: any = await this.getService(CoreServiceName.enum.auth);
                        const sessionData = await authService?.api?.getSession?.({
                            headers: _context?.request?.headers,
                        });
                        if (req.organizationId === '__session__') {
                            req.organizationId = sessionData?.session?.activeOrganizationId ?? undefined;
                        }
                        if (req.createdBy === '__session__') {
                            req.createdBy = sessionData?.user?.id ?? 'system';
                        }
                    } catch {
                        // Fall through — validation below will reject missing fields.
                    }
                }
                if (!req.organizationId || !req.slug || !req.displayName || !req.envType) {
                    return { handled: true, response: this.error('organizationId, slug, displayName, envType are required', 400) };
                }
                const environmentId = randomUUID();
                const environmentDatabaseId = randomUUID();
                const credentialId = randomUUID();
                const nowIso = new Date().toISOString();

                // Bind environment to a driver. `req.driver` is optional — any
                // registered ObjectQL driver is accepted (memory / turso / future
                // sql / postgres). If omitted, pick the best default available.
                const resolved = resolveDriver(req.driver);
                if (!resolved) {
                    const available = listRegisteredDrivers().map((d) => d.name);
                    if (req.driver) {
                        return {
                            handled: true,
                            response: this.error(
                                `Unknown driver '${req.driver}'. Available drivers: [${available.join(', ') || 'none'}]`,
                                400,
                            ),
                        };
                    }
                    return {
                        handled: true,
                        response: this.error(
                            'No ObjectQL driver is registered. Register at least one DriverPlugin (e.g. InMemoryDriver or TursoDriver).',
                            503,
                        ),
                    };
                }
                const driver = resolved.name;
                const region = req.region ?? 'us-east-1';
                const databaseName = `env-${environmentId}`;
                const databaseUrl = buildDatabaseUrl(driver, environmentId);
                const plaintextSecret = `mock-token-${environmentId}`;

                await ql.insert(ENV, {
                    id: environmentId,
                    organization_id: req.organizationId,
                    slug: req.slug,
                    display_name: req.displayName,
                    env_type: req.envType,
                    is_default: req.isDefault ?? false,
                    region,
                    plan: req.plan ?? 'free',
                    status: 'active',
                    created_by: req.createdBy ?? 'system',
                    metadata: req.metadata ? JSON.stringify(req.metadata) : null,
                    created_at: nowIso,
                    updated_at: nowIso,
                });

                await ql.insert(DB, {
                    id: environmentDatabaseId,
                    environment_id: environmentId,
                    database_name: databaseName,
                    database_url: databaseUrl,
                    driver,
                    region,
                    storage_limit_mb: req.storageLimitMb ?? 1024,
                    provisioned_at: nowIso,
                    created_at: nowIso,
                    updated_at: nowIso,
                });

                await ql.insert(CRED, {
                    id: credentialId,
                    environment_database_id: environmentDatabaseId,
                    secret_ciphertext: plaintextSecret,
                    encryption_key_id: 'noop',
                    authorization: 'full_access',
                    status: 'active',
                    created_at: nowIso,
                    updated_at: nowIso,
                });

                const environment = await findOne(ENV, { id: environmentId });
                const database = await findOne(DB, { id: environmentDatabaseId });
                const res = this.success({ environment, database });
                res.status = 201;
                return { handled: true, response: res };
            }

            // ----- /cloud/environments/:id -----
            if (parts.length === 2 && parts[0] === 'environments') {
                const id = decodeURIComponent(parts[1]);

                if (m === 'GET') {
                    const environment = await findOne(ENV, { id });
                    if (!environment) return { handled: true, response: this.error(`Environment '${id}' not found`, 404) };
                    const database = await findOne(DB, { environment_id: id });
                    const credential = database
                        ? await findOne(CRED, { environment_database_id: database.id, status: 'active' })
                        : undefined;
                    const membership = await findOne(MEM, { environment_id: id });
                    // Omit the ciphertext from responses — metadata only.
                    const credMeta = credential
                        ? {
                              id: credential.id,
                              status: credential.status,
                              authorization: credential.authorization,
                              activatedAt: credential.created_at,
                              expiresAt: credential.expires_at,
                          }
                        : undefined;
                    return {
                        handled: true,
                        response: this.success({ environment, database, credential: credMeta, membership }),
                    };
                }

                if (m === 'PATCH') {
                    const patch: Record<string, unknown> = {};
                    if (body?.displayName !== undefined) patch.display_name = body.displayName;
                    if (body?.plan !== undefined) patch.plan = body.plan;
                    if (body?.status !== undefined) patch.status = body.status;
                    if (body?.isDefault !== undefined) patch.is_default = body.isDefault;
                    if (body?.metadata !== undefined) patch.metadata = JSON.stringify(body.metadata);
                    patch.updated_at = new Date().toISOString();
                    await ql.update(ENV, patch, { where: { id } } as any);
                    const environment = await findOne(ENV, { id });
                    if (!environment) return { handled: true, response: this.error(`Environment '${id}' not found`, 404) };
                    return { handled: true, response: this.success({ environment }) };
                }
            }

            // ----- /cloud/environments/:id/activate -----
            if (parts.length === 3 && parts[0] === 'environments' && parts[2] === 'activate' && m === 'POST') {
                const id = decodeURIComponent(parts[1]);
                const environment = await findOne(ENV, { id });
                if (!environment) return { handled: true, response: this.error(`Environment '${id}' not found`, 404) };
                // TODO: persist active_environment_id on the session once session service is wired.
                return { handled: true, response: this.success({ environment, sessionUpdated: false }) };
            }

            // ----- /cloud/environments/:id/credentials/rotate -----
            if (parts.length === 4 && parts[0] === 'environments' && parts[2] === 'credentials' && parts[3] === 'rotate' && m === 'POST') {
                const id = decodeURIComponent(parts[1]);
                const plaintext = body?.plaintext;
                if (!plaintext || typeof plaintext !== 'string') {
                    return { handled: true, response: this.error('plaintext is required', 400) };
                }
                const database = await findOne(DB, { environment_id: id });
                if (!database) return { handled: true, response: this.error(`No database for environment '${id}'`, 404) };

                const nowIso = new Date().toISOString();
                // Revoke existing active credentials
                let existing = await ql.find(CRED, { where: { environment_database_id: database.id, status: 'active' } } as any);
                if (existing && (existing as any).value) existing = (existing as any).value;
                for (const row of (Array.isArray(existing) ? existing : [])) {
                    await ql.update(CRED, {
                        status: 'revoked',
                        revoked_at: nowIso,
                        updated_at: nowIso,
                    }, { where: { id: row.id } } as any);
                }

                const credentialId = randomUUID();
                await ql.insert(CRED, {
                    id: credentialId,
                    environment_database_id: database.id,
                    secret_ciphertext: plaintext,
                    encryption_key_id: 'noop',
                    authorization: 'full_access',
                    status: 'active',
                    created_at: nowIso,
                    updated_at: nowIso,
                });

                const credential = await findOne(CRED, { id: credentialId });
                const credMeta = credential
                    ? {
                          id: credential.id,
                          status: credential.status,
                          authorization: credential.authorization,
                          activatedAt: credential.created_at,
                      }
                    : undefined;
                return { handled: true, response: this.success({ credential: credMeta }) };
            }

            // ----- /cloud/environments/:id/members -----
            if (parts.length === 3 && parts[0] === 'environments' && parts[2] === 'members' && m === 'GET') {
                const id = decodeURIComponent(parts[1]);
                let rows = await ql.find(MEM, { where: { environment_id: id } } as any);
                if (rows && (rows as any).value) rows = (rows as any).value;
                const members = Array.isArray(rows) ? rows : [];
                return { handled: true, response: this.success({ members }) };
            }

            // ----- /cloud/environments/:envId/packages -----
            // GET  /cloud/environments/:envId/packages
            if (parts.length === 3 && parts[0] === 'environments' && parts[2] === 'packages' && m === 'GET') {
                const envId = decodeURIComponent(parts[1]);
                let rows = await ql.find(PKG_INSTALL, { where: { environment_id: envId } } as any);
                if (rows && (rows as any).value) rows = (rows as any).value;
                const packages = Array.isArray(rows) ? rows : [];
                return { handled: true, response: this.success({ packages, total: packages.length }) };
            }

            // POST /cloud/environments/:envId/packages
            if (parts.length === 3 && parts[0] === 'environments' && parts[2] === 'packages' && m === 'POST') {
                const envId = decodeURIComponent(parts[1]);
                const { packageId, version, settings, enableOnInstall } = body ?? {};
                if (!packageId) return { handled: true, response: this.error('packageId is required', 400) };

                // Prevent installing platform-scope packages per-env
                const allPkgs = this.kernel.packages?.getAll?.() ?? [];
                const manifest = allPkgs.find((p: any) => (p.manifest?.id ?? p.id) === packageId)?.manifest ?? allPkgs.find((p: any) => (p.manifest?.id ?? p.id) === packageId);
                if (manifest?.scope === 'platform') {
                    return { handled: true, response: this.error(`Package '${packageId}' has scope=platform and cannot be installed per-environment`, 403) };
                }

                const nowIso = new Date().toISOString();
                const recordId = randomUUID();
                await ql.insert(PKG_INSTALL, {
                    id: recordId,
                    environment_id: envId,
                    package_id: packageId,
                    version: version ?? manifest?.version ?? '1.0.0',
                    status: 'installed',
                    enabled: enableOnInstall !== false,
                    installed_at: nowIso,
                    updated_at: nowIso,
                    settings: settings ? JSON.stringify(settings) : null,
                    upgrade_history: '[]',
                });
                const record = await ql.findOne(PKG_INSTALL, { where: { id: recordId } } as any);
                return { handled: true, response: this.success({ package: record }) };
            }

            // ----- /cloud/environments/:envId/packages/:pkgId -----
            // GET /cloud/environments/:envId/packages/:pkgId
            if (parts.length === 4 && parts[0] === 'environments' && parts[2] === 'packages' && m === 'GET') {
                const envId = decodeURIComponent(parts[1]);
                const pkgId = decodeURIComponent(parts[3]);
                const record = await ql.findOne(PKG_INSTALL, { where: { environment_id: envId, package_id: pkgId } } as any);
                if (!record) return { handled: true, response: this.error(`Package '${pkgId}' is not installed in this environment`, 404) };
                return { handled: true, response: this.success({ package: record }) };
            }

            // DELETE /cloud/environments/:envId/packages/:pkgId
            if (parts.length === 4 && parts[0] === 'environments' && parts[2] === 'packages' && m === 'DELETE') {
                const envId = decodeURIComponent(parts[1]);
                const pkgId = decodeURIComponent(parts[3]);
                const record = await ql.findOne(PKG_INSTALL, { where: { environment_id: envId, package_id: pkgId } } as any) as any;
                if (!record) return { handled: true, response: this.error(`Package '${pkgId}' is not installed in this environment`, 404) };
                if (record.scope === 'platform') {
                    return { handled: true, response: this.error(`Platform-scope package '${pkgId}' cannot be uninstalled`, 403) };
                }
                await ql.delete(PKG_INSTALL, { where: { id: record.id } } as any);
                return { handled: true, response: this.success({ id: record.id, success: true }) };
            }

            // PATCH /cloud/environments/:envId/packages/:pkgId/enable
            if (parts.length === 5 && parts[0] === 'environments' && parts[2] === 'packages' && parts[4] === 'enable' && m === 'PATCH') {
                const envId = decodeURIComponent(parts[1]);
                const pkgId = decodeURIComponent(parts[3]);
                const record = await ql.findOne(PKG_INSTALL, { where: { environment_id: envId, package_id: pkgId } } as any) as any;
                if (!record) return { handled: true, response: this.error(`Package '${pkgId}' is not installed in this environment`, 404) };
                const nowIso = new Date().toISOString();
                await ql.update(PKG_INSTALL, { enabled: true, status: 'installed', updated_at: nowIso }, { where: { id: record.id } } as any);
                const updated = await ql.findOne(PKG_INSTALL, { where: { id: record.id } } as any);
                return { handled: true, response: this.success({ package: updated }) };
            }

            // PATCH /cloud/environments/:envId/packages/:pkgId/disable
            if (parts.length === 5 && parts[0] === 'environments' && parts[2] === 'packages' && parts[4] === 'disable' && m === 'PATCH') {
                const envId = decodeURIComponent(parts[1]);
                const pkgId = decodeURIComponent(parts[3]);
                const record = await ql.findOne(PKG_INSTALL, { where: { environment_id: envId, package_id: pkgId } } as any) as any;
                if (!record) return { handled: true, response: this.error(`Package '${pkgId}' is not installed in this environment`, 404) };
                if (record.scope === 'platform') {
                    return { handled: true, response: this.error(`Platform-scope package '${pkgId}' cannot be disabled`, 403) };
                }
                const nowIso = new Date().toISOString();
                await ql.update(PKG_INSTALL, { enabled: false, status: 'disabled', updated_at: nowIso }, { where: { id: record.id } } as any);
                const updated = await ql.findOne(PKG_INSTALL, { where: { id: record.id } } as any);
                return { handled: true, response: this.success({ package: updated }) };
            }

            // POST /cloud/environments/:envId/packages/:pkgId/upgrade
            if (parts.length === 5 && parts[0] === 'environments' && parts[2] === 'packages' && parts[4] === 'upgrade' && m === 'POST') {
                const envId = decodeURIComponent(parts[1]);
                const pkgId = decodeURIComponent(parts[3]);
                const record = await ql.findOne(PKG_INSTALL, { where: { environment_id: envId, package_id: pkgId } } as any) as any;
                if (!record) return { handled: true, response: this.error(`Package '${pkgId}' is not installed in this environment`, 404) };
                const { targetVersion } = body ?? {};
                const allPkgs2 = this.kernel.packages?.getAll?.() ?? [];
                const manifest2 = allPkgs2.find((p: any) => (p.manifest?.id ?? p.id) === pkgId)?.manifest ?? allPkgs2.find((p: any) => (p.manifest?.id ?? p.id) === pkgId);
                const newVersion = targetVersion ?? manifest2?.version ?? record.version;
                const nowIso = new Date().toISOString();
                const history = (() => { try { return JSON.parse(record.upgrade_history || '[]'); } catch { return []; } })();
                history.push({ fromVersion: record.version, toVersion: newVersion, upgradedAt: nowIso, status: 'success' });
                await ql.update(PKG_INSTALL, {
                    version: newVersion,
                    status: 'installed',
                    updated_at: nowIso,
                    upgrade_history: JSON.stringify(history),
                }, { where: { id: record.id } } as any);
                const updated = await ql.findOne(PKG_INSTALL, { where: { id: record.id } } as any);
                return { handled: true, response: this.success({ package: updated }) };
            }

        } catch (e: any) {
            return { handled: true, response: this.error(e.message, e.statusCode || 500) };
        }

        return { handled: false };
    }



    /**
     * Handles Storage requests
     * path: sub-path after /storage/
     */
    async handleStorage(path: string, method: string, file: any, context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        const storageService = await this.getService(CoreServiceName.enum['file-storage']) || this.kernel.services?.['file-storage'];
        if (!storageService) {
             return { handled: true, response: this.error('File storage not configured', 501) };
        }
        
        const m = method.toUpperCase();
        const parts = path.replace(/^\/+/, '').split('/');
        
        // POST /storage/upload
        if (parts[0] === 'upload' && m === 'POST') {
            if (!file) {
                 return { handled: true, response: this.error('No file provided', 400) };
            }
            const result = await storageService.upload(file, { request: context.request });
            return { handled: true, response: this.success(result) };
        }
        
        // GET /storage/file/:id
        if (parts[0] === 'file' && parts[1] && m === 'GET') {
            const id = parts[1];
            const result = await storageService.download(id, { request: context.request });
            
            // Result can be URL (redirect), Stream/Blob, or metadata
            if (result.url && result.redirect) {
                // Must be handled by adapter to do actual redirect
                return { handled: true, result: { type: 'redirect', url: result.url } };
            }
            
            if (result.stream) {
                 // Must be handled by adapter to pipe stream
                 return { 
                     handled: true, 
                     result: { 
                         type: 'stream', 
                         stream: result.stream, 
                         headers: {
                             'Content-Type': result.mimeType || 'application/octet-stream',
                             'Content-Length': result.size
                         }
                     } 
                 };
            }
            
            return { handled: true, response: this.success(result) };
        }
        
        return { handled: false };
    }

    /**
     * Handles UI requests
     * path: sub-path after /ui/
     */
    async handleUi(path: string, query: any, _context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        const parts = path.replace(/^\/+/, '').split('/').filter(Boolean);
        
        // GET /ui/view/:object (with optional type param)
        if (parts[0] === 'view' && parts[1]) {
            const objectName = parts[1];
            // Support both path param /view/obj/list AND query param /view/obj?type=list
            const type = parts[2] || query?.type || 'list';

            const protocol = await this.resolveService('protocol');
            
            if (protocol && typeof protocol.getUiView === 'function') {
                try {
                    const result = await protocol.getUiView({ object: objectName, type });
                    return { handled: true, response: this.success(result) };
                } catch (e: any) {
                    return { handled: true, response: this.error(e.message, 500) };
                }
            } else {
                 return { handled: true, response: this.error('Protocol service not available', 503) };
            }
        }

        return { handled: false };
    }

    /**
     * Handles Automation requests
     * path: sub-path after /automation/
     *
     * Routes:
     *   GET    /                     → listFlows
     *   GET    /:name                → getFlow
     *   POST   /                     → createFlow (registerFlow)
     *   PUT    /:name                → updateFlow
     *   DELETE /:name                → deleteFlow (unregisterFlow)
     *   POST   /:name/trigger        → execute (legacy: trigger/:name also supported)
     *   POST   /:name/toggle         → toggleFlow
     *   GET    /:name/runs           → listRuns
     *   GET    /:name/runs/:runId    → getRun
     */
    async handleAutomation(path: string, method: string, body: any, context: HttpProtocolContext, query?: any): Promise<HttpDispatcherResult> {
        const automationService = await this.getService(CoreServiceName.enum.automation);
        if (!automationService) return { handled: false };

        const m = method.toUpperCase();
        const parts = path.replace(/^\/+/, '').split('/').filter(Boolean);

        // Legacy: POST /automation/trigger/:name
        if (parts[0] === 'trigger' && parts[1] && m === 'POST') {
             const triggerName = parts[1];
             if (typeof automationService.trigger === 'function') {
                 const result = await automationService.trigger(triggerName, body, { request: context.request });
                 return { handled: true, response: this.success(result) };
             }
             // Fallback to execute
             if (typeof automationService.execute === 'function') {
                 const result = await automationService.execute(triggerName, body);
                 return { handled: true, response: this.success(result) };
             }
        }

        // GET / → listFlows
        if (parts.length === 0 && m === 'GET') {
            if (typeof automationService.listFlows === 'function') {
                const names = await automationService.listFlows();
                return { handled: true, response: this.success({ flows: names, total: names.length, hasMore: false }) };
            }
        }

        // POST / → createFlow
        if (parts.length === 0 && m === 'POST') {
            if (typeof automationService.registerFlow === 'function') {
                automationService.registerFlow(body?.name, body);
                return { handled: true, response: this.success(body) };
            }
        }

        // Routes with :name
        if (parts.length >= 1) {
            const name = parts[0];

            // POST /:name/trigger → execute
            if (parts[1] === 'trigger' && m === 'POST') {
                if (typeof automationService.execute === 'function') {
                    const result = await automationService.execute(name, body);
                    return { handled: true, response: this.success(result) };
                }
            }

            // POST /:name/toggle → toggleFlow
            if (parts[1] === 'toggle' && m === 'POST') {
                if (typeof automationService.toggleFlow === 'function') {
                    await automationService.toggleFlow(name, body?.enabled ?? true);
                    return { handled: true, response: this.success({ name, enabled: body?.enabled ?? true }) };
                }
            }

            // GET /:name/runs/:runId → getRun
            if (parts[1] === 'runs' && parts[2] && m === 'GET') {
                if (typeof automationService.getRun === 'function') {
                    const run = await automationService.getRun(parts[2]);
                    if (!run) return { handled: true, response: this.error('Execution not found', 404) };
                    return { handled: true, response: this.success(run) };
                }
            }

            // GET /:name/runs → listRuns
            if (parts[1] === 'runs' && !parts[2] && m === 'GET') {
                if (typeof automationService.listRuns === 'function') {
                    const options = query ? { limit: query.limit ? Number(query.limit) : undefined, cursor: query.cursor } : undefined;
                    const runs = await automationService.listRuns(name, options);
                    return { handled: true, response: this.success({ runs, hasMore: false }) };
                }
            }

            // GET /:name → getFlow (no sub-path)
            if (parts.length === 1 && m === 'GET') {
                if (typeof automationService.getFlow === 'function') {
                    const flow = await automationService.getFlow(name);
                    if (!flow) return { handled: true, response: this.error('Flow not found', 404) };
                    return { handled: true, response: this.success(flow) };
                }
            }

            // PUT /:name → updateFlow
            if (parts.length === 1 && m === 'PUT') {
                if (typeof automationService.registerFlow === 'function') {
                    automationService.registerFlow(name, body?.definition ?? body);
                    return { handled: true, response: this.success(body?.definition ?? body) };
                }
            }

            // DELETE /:name → deleteFlow
            if (parts.length === 1 && m === 'DELETE') {
                if (typeof automationService.unregisterFlow === 'function') {
                    automationService.unregisterFlow(name);
                    return { handled: true, response: this.success({ name, deleted: true }) };
                }
            }
        }
        
        return { handled: false };
    }

    private getServicesMap(): Record<string, any> {
        if (this.kernel.services instanceof Map) {
            return Object.fromEntries(this.kernel.services);
        }
        return this.kernel.services || {};
    }

    private async getService(name: CoreServiceName) {
        return this.resolveService(name);
    }

    /**
     * Resolve any service by name, supporting async factories.
     * Fallback chain: getServiceAsync → getService (sync) → context.getService → services map.
     * Only returns when a non-null service is found; otherwise falls through to the next step.
     */
    private async resolveService(name: string) {
        // Prefer async resolution to support factory-based services (e.g. auth, analytics, protocol)
        if (typeof this.kernel.getServiceAsync === 'function') {
            try {
                const svc = await this.kernel.getServiceAsync(name);
                if (svc != null) return svc;
            } catch {
                // Service not registered or async resolution failed — fall through
            }
        }
        if (typeof this.kernel.getService === 'function') {
            try {
                const svc = await this.kernel.getService(name);
                if (svc != null) return svc;
            } catch {
                // Service not registered or sync resolution threw "is async" — fall through
            }
        }
        if (this.kernel?.context?.getService) {
            try {
                const svc = await this.kernel.context.getService(name);
                if (svc != null) return svc;
            } catch {
                // Service not registered — fall through
            }
        }
        const services = this.getServicesMap();
        return services[name];
    }

    /**
     * Get the ObjectQL service which provides access to SchemaRegistry.
     * Tries multiple access patterns since kernel structure varies.
     */
    private async getObjectQLService(): Promise<any> {
        // 1. Try via resolveService (handles async factories, sync, context, and map)
        try {
            const svc = await this.resolveService('objectql');
            if (svc?.registry) return svc;
        } catch { /* service not available */ }
        return null;
    }

    /**
     * Handle AI service routes (/ai/chat, /ai/models, /ai/conversations, etc.)
     * Resolves the AI service and its built-in route handlers, then dispatches.
     */
    async handleAI(subPath: string, method: string, body: any, query: any, _context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        let aiService: any;
        try {
            aiService = await this.resolveService('ai');
        } catch {
            // AI service not registered
        }

        if (!aiService) {
            return {
                handled: true,
                response: {
                    status: 404,
                    body: { success: false, error: { message: 'AI service is not configured', code: 404 } },
                },
            };
        }

        // The AI service exposes route definitions via buildAIRoutes.
        // We match the request path against known AI route patterns.
        const fullPath = `/api/v1${subPath}`;

        // Build a simple param-extracting matcher for route patterns like /api/v1/ai/conversations/:id
        const matchRoute = (pattern: string, path: string): Record<string, string> | null => {
            const patternParts = pattern.split('/');
            const pathParts = path.split('/');
            if (patternParts.length !== pathParts.length) return null;
            const params: Record<string, string> = {};
            for (let i = 0; i < patternParts.length; i++) {
                if (patternParts[i].startsWith(':')) {
                    params[patternParts[i].substring(1)] = pathParts[i];
                } else if (patternParts[i] !== pathParts[i]) {
                    return null;
                }
            }
            return params;
        };

        // Try to get route definitions from the AI service's cached routes
        const routes = (this.kernel as any).__aiRoutes as Array<{
            method: string; path: string; handler: (req: any) => Promise<any>;
        }> | undefined;

        if (!routes) {
            return {
                handled: true,
                response: {
                    status: 503,
                    body: { success: false, error: { message: 'AI service routes not yet initialized', code: 503 } },
                },
            };
        }

        for (const route of routes) {
            if (route.method !== method) continue;
            const params = matchRoute(route.path, fullPath);
            if (params === null) continue;

            const result = await route.handler({ body, params, query });

            if (result.stream && result.events) {
                // Return a streaming result for the adapter to handle
                return {
                    handled: true,
                    result: {
                        type: 'stream',
                        contentType: result.vercelDataStream
                            ? 'text/plain; charset=utf-8'
                            : 'text/event-stream',
                        events: result.events,
                        vercelDataStream: result.vercelDataStream,
                        headers: {
                            'Content-Type': result.vercelDataStream
                                ? 'text/plain; charset=utf-8'
                                : 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                        },
                    },
                };
            }

            return {
                handled: true,
                response: {
                    status: result.status,
                    body: result.body,
                },
            };
        }

        return {
            handled: true,
            response: this.routeNotFound(subPath),
        };
    }

    /**
     * Main Dispatcher Entry Point
     * Routes the request to the appropriate handler based on path and precedence
     */
    async dispatch(method: string, path: string, body: any, query: any, context: HttpProtocolContext, prefix?: string): Promise<HttpDispatcherResult> {
        const cleanPath = path.replace(/\/$/, ''); // Remove trailing slash if present, but strict on clean paths

        // 0. Discovery Endpoint (GET /discovery or GET /)
        // Standard route: /discovery (protocol-compliant)
        // Legacy route: / (empty path, for backward compatibility — MSW strips base URL)
        if ((cleanPath === '/discovery' || cleanPath === '') && method === 'GET') {
             const info = await this.getDiscoveryInfo(prefix ?? '');
             return { 
                 handled: true, 
                 response: this.success(info) 
             };
        }

        // 0b. Health Endpoint (GET /health)
        if (cleanPath === '/health' && method === 'GET') {
            return {
                handled: true,
                response: this.success({
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0',
                    uptime: typeof process !== 'undefined' ? process.uptime() : undefined,
                }),
            };
        }

        // 1. System Protocols (Prefix-based)
        if (cleanPath.startsWith('/auth')) {
            return this.handleAuth(cleanPath.substring(5), method, body, context);
        }
        
        if (cleanPath.startsWith('/meta')) {
             return this.handleMetadata(cleanPath.substring(5), context, method, body, query);
        }

        if (cleanPath.startsWith('/data')) {
            return this.handleData(cleanPath.substring(5), method, body, query, context);
        }
        
        if (cleanPath.startsWith('/graphql')) {
             if (method === 'POST') return this.handleGraphQL(body, context);
             // GraphQL usually GET for Playground is handled by middleware but we can return 405 or handle it
        }

        if (cleanPath.startsWith('/storage')) {
             return this.handleStorage(cleanPath.substring(8), method, body, context); // body here is file/stream for upload
        }
        
        if (cleanPath.startsWith('/ui')) {
             return this.handleUi(cleanPath.substring(3), query, context);
        }

        if (cleanPath.startsWith('/automation')) {
             return this.handleAutomation(cleanPath.substring(11), method, body, context, query);
        }
        
        if (cleanPath.startsWith('/analytics')) {
             return this.handleAnalytics(cleanPath.substring(10), method, body, context);
        }

        if (cleanPath.startsWith('/packages')) {
             return this.handlePackages(cleanPath.substring(9), method, body, query, context);
        }

        if (cleanPath.startsWith('/cloud')) {
             return this.handleCloud(cleanPath.substring(6), method, body, query, context);
        }

        if (cleanPath.startsWith('/i18n')) {
             return this.handleI18n(cleanPath.substring(5), method, query, context);
        }

        // AI Service — delegate to the registered AI route handlers
        if (cleanPath.startsWith('/ai')) {
             return this.handleAI(cleanPath, method, body, query, context);
        }

        // OpenAPI Specification
        if (cleanPath === '/openapi.json' && method === 'GET') {
             try {
                const metaSvc = await this.resolveService('metadata');
                if (metaSvc && typeof (metaSvc as any).generateOpenApi === 'function') {
                    const result = await (metaSvc as any).generateOpenApi({});
                    return { handled: true, response: this.success(result) };
                }
             } catch (e) {
                // If not implemented, fall through or return 404
             }
        }

        // 2. Custom API Endpoints (Registry lookup)
        // Check if there is a custom endpoint defined for this path
        const result = await this.handleApiEndpoint(cleanPath, method, body, query, context);
        if (result.handled) return result;

        // 3. Fallback — return semantic 404 with diagnostic info
        return {
            handled: true,
            response: this.routeNotFound(cleanPath),
        };
    }

    /**
     * Handles Custom API Endpoints defined in metadata
     */
    async handleApiEndpoint(path: string, method: string, body: any, query: any, context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        try {
            // Attempt to find a matching endpoint in the registry
            const metaSvc = await this.resolveService('metadata');
            if (!metaSvc || typeof (metaSvc as any).matchEndpoint !== 'function') {
                return { handled: false };
            }
            const endpoint = await (metaSvc as any).matchEndpoint({ path, method });
            
            if (endpoint) {
                // Execute the endpoint target logic
                if (endpoint.type === 'flow') {
                    const automationSvc = await this.resolveService('automation');
                    if (!automationSvc || typeof (automationSvc as any).runFlow !== 'function') {
                        return { handled: true, response: this.error('Automation service not available', 503) };
                    }
                    const result = await (automationSvc as any).runFlow({ 
                        flowId: endpoint.target, 
                        inputs: { ...query, ...body, _request: context.request } 
                    });
                     return { handled: true, response: this.success(result) };
                }
                
                if (endpoint.type === 'script') {
                    const automationSvc = await this.resolveService('automation');
                    if (!automationSvc || typeof (automationSvc as any).runScript !== 'function') {
                        return { handled: true, response: this.error('Automation service not available', 503) };
                    }
                     const result = await (automationSvc as any).runScript({ 
                        scriptName: endpoint.target, 
                        context: { ...query, ...body, request: context.request } 
                    });
                     return { handled: true, response: this.success(result) };
                }

                if (endpoint.type === 'object_operation') {
                    // e.g. Proxy to an object action
                    if (endpoint.objectParams) {
                        const { object, operation } = endpoint.objectParams;
                        // Map standard CRUD operations
                        if (operation === 'find') {
                             const result = await this.callData('query', { object, query });
                             // Spec: FindDataResponse = { object, records, total?, hasMore? }
                             return { handled: true, response: this.success(result.records, { total: result.total }) };
                        }
                        if (operation === 'get' && query.id) {
                             const result = await this.callData('get', { object, id: query.id });
                             return { handled: true, response: this.success(result) };
                        }
                         if (operation === 'create') {
                             const result = await this.callData('create', { object, data: body });
                             return { handled: true, response: this.success(result) };
                        }
                    }
                }

                if (endpoint.type === 'proxy') {
                     return { 
                         handled: true, 
                         response: { 
                             status: 200, 
                             body: { proxy: true, target: endpoint.target, note: 'Proxy execution requires http-client service' } 
                         } 
                     };
                }
            }
        } catch (e) {
            // If matchEndpoint fails (e.g. not found), we just return not handled
            // so we can fallback to 404 or other handlers
        }

        return { handled: false };
    }
}
