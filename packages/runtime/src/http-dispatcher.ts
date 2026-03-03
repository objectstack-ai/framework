// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectKernel, getEnv } from '@objectstack/core';
import { CoreServiceName } from '@objectstack/spec/system';

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
    private kernel: any; // Casting to any to access dynamic props like broker, services, graphql

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

    private ensureBroker() {
        if (!this.kernel.broker) {
            throw { statusCode: 500, message: 'Kernel Broker not available' };
        }
        return this.kernel.broker;
    }

    /**
     * Generates the discovery JSON response for the API root
     */
    getDiscoveryInfo(prefix: string) {
        const services = this.getServicesMap();
        
        // All services are plugin-provided — check if a plugin has registered them
        const hasAuth         = !!services[CoreServiceName.enum.auth];
        const hasGraphQL      = !!(services[CoreServiceName.enum.graphql] || this.kernel.graphql);
        const hasSearch       = !!services[CoreServiceName.enum.search];
        const hasWebSockets   = !!services[CoreServiceName.enum.realtime];
        const hasFiles        = !!(services[CoreServiceName.enum['file-storage']] || services['storage']?.supportsFiles);
        const hasAnalytics    = !!services[CoreServiceName.enum.analytics];
        const hasWorkflow     = !!services[CoreServiceName.enum.workflow];
        const hasAi           = !!services[CoreServiceName.enum.ai];
        const hasNotification = !!services[CoreServiceName.enum.notification];
        const hasI18n         = !!services[CoreServiceName.enum.i18n];
        const hasUi           = !!services[CoreServiceName.enum.ui];
        const hasAutomation   = !!services[CoreServiceName.enum.automation];
        const hasCache        = !!services[CoreServiceName.enum.cache];
        const hasQueue        = !!services[CoreServiceName.enum.queue];
        const hasJob          = !!services[CoreServiceName.enum.job];

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
        const svcAvailable = (route?: string, provider?: string) => ({
            enabled: true, status: 'available' as const, route, provider,
        });
        const svcUnavailable = (name: string) => ({
            enabled: false, status: 'unavailable' as const,
            message: `Install a ${name} plugin to enable`,
        });

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
                metadata:       { enabled: true, status: 'degraded' as const, route: routes.metadata, provider: 'kernel', message: 'In-memory registry; DB persistence pending' },
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
            locale: {
                default: 'en',
                supported: ['en', 'zh-CN'],
                timezone: 'UTC'
            }
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

        // 2. Legacy Login
        const normalizedPath = path.replace(/^\/+/, '');
        if (normalizedPath === 'login' && method.toUpperCase() === 'POST') {
             const broker = this.ensureBroker();
             const data = await broker.call('auth.login', body, { request: context.request });
             return { handled: true, response: { status: 200, body: data } };
        }

        return { handled: false };
    }

    /**
     * Handles Metadata requests
     * Standard: /metadata/:type/:name
     * Fallback for backward compat: /metadata (all objects), /metadata/:objectName (get object)
     */
    async handleMetadata(path: string, context: HttpProtocolContext, method?: string, body?: any, query?: any): Promise<HttpDispatcherResult> {
        const broker = this.ensureBroker();
        const parts = path.replace(/^\/+/, '').split('/').filter(Boolean);
        
        // GET /metadata/types
        if (parts[0] === 'types') {
            // Try protocol service for dynamic types
            const protocol = this.kernel?.context?.getService ? await this.kernel.context.getService('protocol') : null;
            if (protocol && typeof protocol.getMetaTypes === 'function') {
                const result = await protocol.getMetaTypes({});
                return { handled: true, response: this.success(result) };
            }
            // Fallback: ask broker for registered types
            try {
                const data = await broker.call('metadata.types', {}, { request: context.request });
                return { handled: true, response: this.success(data) };
            } catch {
                // Last resort: hardcoded defaults
                return { handled: true, response: this.success({ types: ['object', 'app', 'plugin'] }) };
            }
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
            // Broker fallback
            try {
                const data = await broker.call('metadata.getPublished', { type, name }, { request: context.request });
                return { handled: true, response: this.success(data) };
            } catch (e: any) {
                return { handled: true, response: this.error(e.message, 404) };
            }
        }

        // /metadata/:type/:name
        if (parts.length === 2) {
            const [type, name] = parts;

            // PUT /metadata/:type/:name (Save)
            if (method === 'PUT' && body) {
                // Try to get the protocol service directly
                const protocol = this.kernel?.context?.getService ? await this.kernel.context.getService('protocol') : null;
                
                if (protocol && typeof protocol.saveMetaItem === 'function') {
                    try {
                        const result = await protocol.saveMetaItem({ type, name, item: body });
                        return { handled: true, response: this.success(result) };
                    } catch (e: any) {
                        return { handled: true, response: this.error(e.message, 400) };
                    }
                }
                
                // Fallback to broker if protocol not available (legacy)
                try {
                     const data = await broker.call('metadata.saveItem', { type, name, item: body }, { request: context.request });
                     return { handled: true, response: this.success(data) };
                } catch (e: any) {
                     // If broker doesn't support it either
                     return { handled: true, response: this.error(e.message || 'Save not supported', 501) };
                }
            }

            try {
                // Try specific calls based on type
                if (type === 'objects' || type === 'object') {
                    const data = await broker.call('metadata.getObject', { objectName: name }, { request: context.request });
                    return { handled: true, response: this.success(data) };
                }

                // If type is singular (e.g. 'app'), use it directly
                // If plural (e.g. 'apps'), slice it
                const singularType = type.endsWith('s') ? type.slice(0, -1) : type;
                
                // Try Protocol Service First (Preferred)
                const protocol = this.kernel?.context?.getService ? await this.kernel.context.getService('protocol') : null;
                if (protocol && typeof protocol.getMetaItem === 'function') {
                     try {
                        const data = await protocol.getMetaItem({ type: singularType, name });
                        return { handled: true, response: this.success(data) };
                     } catch (e: any) {
                        // Protocol might throw if not found or not supported
                        // Fallback to broker?
                     }
                }

                // Generic call for other types if supported via Broker (Legacy)
                const method = `metadata.get${this.capitalize(singularType)}`;
                const data = await broker.call(method, { name }, { request: context.request });
                return { handled: true, response: this.success(data) };
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
            const protocol = this.kernel?.context?.getService ? await this.kernel.context.getService('protocol') : null;
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

            // Try broker for the type
            try {
                if (typeOrName === 'objects') {
                    const data = await broker.call('metadata.objects', { packageId }, { request: context.request });
                    return { handled: true, response: this.success(data) };
                }
                const data = await broker.call(`metadata.${typeOrName}`, { packageId }, { request: context.request });
                if (data !== null && data !== undefined) {
                    return { handled: true, response: this.success(data) };
                }
            } catch {
                // Broker doesn't support this action, fall through
            }

            // Legacy: /metadata/:objectName (treat as single object lookup)
            try {
                const data = await broker.call('metadata.getObject', { objectName: typeOrName }, { request: context.request });
                return { handled: true, response: this.success(data) };
            } catch (e: any) {
                return { handled: true, response: this.error(e.message, 404) };
            }
        }

        // GET /metadata — return available metadata types
        if (parts.length === 0) {
            // Try protocol service for dynamic types
            const protocol = this.kernel?.context?.getService ? await this.kernel.context.getService('protocol') : null;
            if (protocol && typeof protocol.getMetaTypes === 'function') {
                const result = await protocol.getMetaTypes({});
                return { handled: true, response: this.success(result) };
            }
            // Fallback: ask broker for registered types
            try {
                const data = await broker.call('metadata.types', {}, { request: context.request });
                return { handled: true, response: this.success(data) };
            } catch {
                return { handled: true, response: this.success({ types: ['object', 'app', 'plugin'] }) };
            }
        }
        
        return { handled: false };
    }

    /**
     * Handles Data requests
     * path: sub-path after /data/ (e.g. "contacts", "contacts/123", "contacts/query")
     */
    async handleData(path: string, method: string, body: any, query: any, context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        const broker = this.ensureBroker();
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
                // Spec: broker returns FindDataResponse = { object, records, total?, hasMore? }
                const result = await broker.call('data.query', { object: objectName, ...body }, { request: context.request });
                return { handled: true, response: this.success(result) };
            }

            // POST /data/:object/batch
            if (action === 'batch' && m === 'POST') {
                const result = await broker.call('data.batch', { object: objectName, ...body }, { request: context.request });
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
                // Spec: broker returns GetDataResponse = { object, id, record }
                const result = await broker.call('data.get', { object: objectName, id, ...allowedParams }, { request: context.request });
                return { handled: true, response: this.success(result) };
            }

            // PATCH /data/:object/:id
            if (parts.length === 2 && m === 'PATCH') {
                const id = parts[1];
                // Spec: broker returns UpdateDataResponse = { object, id, record }
                const result = await broker.call('data.update', { object: objectName, id, data: body }, { request: context.request });
                return { handled: true, response: this.success(result) };
            }

            // DELETE /data/:object/:id
            if (parts.length === 2 && m === 'DELETE') {
                const id = parts[1];
                // Spec: broker returns DeleteDataResponse = { object, id, deleted }
                const result = await broker.call('data.delete', { object: objectName, id }, { request: context.request });
                return { handled: true, response: this.success(result) };
            }
        } else {
            // GET /data/:object (List)
            if (m === 'GET') {
                // Spec: broker returns FindDataResponse = { object, records, total?, hasMore? }
                const result = await broker.call('data.query', { object: objectName, query }, { request: context.request });
                return { handled: true, response: this.success(result) };
            }

            // POST /data/:object (Create)
            if (m === 'POST') {
                // Spec: broker returns CreateDataResponse = { object, id, record }
                const result = await broker.call('data.create', { object: objectName, data: body }, { request: context.request });
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
    async handleAnalytics(path: string, method: string, body: any, context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        const analyticsService = await this.getService(CoreServiceName.enum.analytics);
        if (!analyticsService) return { handled: false }; // 404 handled by caller if unhandled

        const m = method.toUpperCase();
        const subPath = path.replace(/^\/+/, '');

        // POST /analytics/query
        if (subPath === 'query' && m === 'POST') {
            const result = await analyticsService.query(body, { request: context.request });
            return { handled: true, response: this.success(result) };
        }

        // GET /analytics/meta
        if (subPath === 'meta' && m === 'GET') {
            const result = await analyticsService.getMetadata({ request: context.request });
             return { handled: true, response: this.success(result) };
        }

        // POST /analytics/sql (Dry-run or debug)
        if (subPath === 'sql' && m === 'POST') {
             // Assuming service has generateSql method
             const result = await analyticsService.generateSql(body, { request: context.request });
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
    async handleI18n(path: string, method: string, query: any, context: HttpProtocolContext): Promise<HttpDispatcherResult> {
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
            const locale = parts[1] || query?.locale;
            if (!locale) return { handled: true, response: this.error('Missing locale parameter', 400) };
            const translations = i18nService.getTranslations(locale);
            return { handled: true, response: this.success({ locale, translations }) };
        }

        // GET /i18n/labels/:object/:locale  OR  /i18n/labels/:object?locale=xx
        if (parts[0] === 'labels' && parts.length >= 2) {
            const objectName = decodeURIComponent(parts[1]);
            const locale = parts[2] ? decodeURIComponent(parts[2]) : query?.locale;
            if (!locale) return { handled: true, response: this.error('Missing locale parameter', 400) };
            if (typeof i18nService.getFieldLabels === 'function') {
                const labels = i18nService.getFieldLabels(objectName, locale);
                return { handled: true, response: this.success({ object: objectName, locale, labels }) };
            }
            // Fallback: derive field labels from full translation bundle
            const translations = i18nService.getTranslations(locale);
            const prefix = `o.${objectName}.fields.`;
            const labels: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(translations)) {
                if (key.startsWith(prefix)) {
                    labels[key.substring(prefix.length)] = value;
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
     * Uses ObjectQL SchemaRegistry directly (via the 'objectql' service)
     * with broker fallback for backward compatibility.
     */
    async handlePackages(path: string, method: string, body: any, query: any, context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        const m = method.toUpperCase();
        const parts = path.replace(/^\/+/, '').split('/').filter(Boolean);

        // Try to get SchemaRegistry from the ObjectQL service
        const qlService = await this.getObjectQLService();
        const registry = qlService?.registry;

        // If no registry available, try broker as fallback
        if (!registry) {
            if (this.kernel.broker) {
                return this.handlePackagesViaBroker(parts, m, body, query, context);
            }
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
                // Broker fallback
                if (this.kernel.broker) {
                    const result = await this.kernel.broker.call('metadata.publishPackage', { packageId: id, ...body }, { request: context.request });
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
                // Broker fallback
                if (this.kernel.broker) {
                    await this.kernel.broker.call('metadata.revertPackage', { packageId: id }, { request: context.request });
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
     * Fallback: handle packages via broker (for backward compatibility)
     */
    private async handlePackagesViaBroker(parts: string[], m: string, body: any, query: any, context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        const broker = this.kernel.broker;
        try {
            if (parts.length === 0 && m === 'GET') {
                const result = await broker.call('package.list', query || {}, { request: context.request });
                return { handled: true, response: this.success(result) };
            }
            if (parts.length === 0 && m === 'POST') {
                const result = await broker.call('package.install', body, { request: context.request });
                const res = this.success(result);
                res.status = 201;
                return { handled: true, response: res };
            }
            if (parts.length === 2 && parts[1] === 'enable' && m === 'PATCH') {
                const id = decodeURIComponent(parts[0]);
                const result = await broker.call('package.enable', { id }, { request: context.request });
                return { handled: true, response: this.success(result) };
            }
            if (parts.length === 2 && parts[1] === 'disable' && m === 'PATCH') {
                const id = decodeURIComponent(parts[0]);
                const result = await broker.call('package.disable', { id }, { request: context.request });
                return { handled: true, response: this.success(result) };
            }
            if (parts.length === 1 && m === 'GET') {
                const id = decodeURIComponent(parts[0]);
                const result = await broker.call('package.get', { id }, { request: context.request });
                return { handled: true, response: this.success(result) };
            }
            if (parts.length === 1 && m === 'DELETE') {
                const id = decodeURIComponent(parts[0]);
                const result = await broker.call('package.uninstall', { id }, { request: context.request });
                return { handled: true, response: this.success(result) };
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

            const protocol = this.kernel?.context?.getService ? await this.kernel.context.getService('protocol') : null;
            
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
        if (typeof this.kernel.getService === 'function') {
            return await this.kernel.getService(name);
        }
        const services = this.getServicesMap();
        return services[name];
    }

    /**
     * Get the ObjectQL service which provides access to SchemaRegistry.
     * Tries multiple access patterns since kernel structure varies.
     */
    private async getObjectQLService(): Promise<any> {
        // 1. Try via kernel.getService
        if (typeof this.kernel.getService === 'function') {
            try {
                const svc = await this.kernel.getService('objectql');
                if (svc?.registry) return svc;
            } catch { /* ignore */ }
        }
        // 2. Try via kernel context
        if (this.kernel?.context?.getService) {
            try {
                const svc = await this.kernel.context.getService('objectql');
                if (svc?.registry) return svc;
            } catch { /* ignore */ }
        }
        // 3. Try via services map
        const services = this.getServicesMap();
        if (services['objectql']?.registry) return services['objectql'];
        return null;
    }

    private capitalize(s: string) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    /**
     * Main Dispatcher Entry Point
     * Routes the request to the appropriate handler based on path and precedence
     */
    async dispatch(method: string, path: string, body: any, query: any, context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        const cleanPath = path.replace(/\/$/, ''); // Remove trailing slash if present, but strict on clean paths

        // 0. Root Discovery Endpoint (GET /)
        // Handles request to base URL (e.g. /api/v1) which MSW strips to empty string
        if (cleanPath === '' && method === 'GET') {
             // We use '' as prefix since we are internal dispatcher
             const info = this.getDiscoveryInfo('');
             return { 
                 handled: true, 
                 response: this.success(info) 
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

        if (cleanPath.startsWith('/i18n')) {
             return this.handleI18n(cleanPath.substring(5), method, query, context);
        }

        // OpenAPI Specification
        if (cleanPath === '/openapi.json' && method === 'GET') {
             const broker = this.ensureBroker();
             try {
                const result = await broker.call('metadata.generateOpenApi', {}, { request: context.request });
                return { handled: true, response: this.success(result) };
             } catch (e) {
                // If not implemented, fall through or return 404
             }
        }

        // 2. Custom API Endpoints (Registry lookup)
        // Check if there is a custom endpoint defined for this path
        const result = await this.handleApiEndpoint(cleanPath, method, body, query, context);
        if (result.handled) return result;

        // 3. Fallback (404)
        return { handled: false };
    }

    /**
     * Handles Custom API Endpoints defined in metadata
     */
    async handleApiEndpoint(path: string, method: string, body: any, query: any, context: HttpProtocolContext): Promise<HttpDispatcherResult> {
        const broker = this.ensureBroker();
        try {
            // Attempt to find a matching endpoint in the registry
            // This assumes a 'metadata.matchEndpoint' action exists in the kernel/registry
            // path should include initial slash e.g. /api/v1/customers
            const endpoint = await broker.call('metadata.matchEndpoint', { path, method });
            
            if (endpoint) {
                // Execute the endpoint target logic
                if (endpoint.type === 'flow') {
                    const result = await broker.call('automation.runFlow', { 
                        flowId: endpoint.target, 
                        inputs: { ...query, ...body, _request: context.request } 
                    });
                     return { handled: true, response: this.success(result) };
                }
                
                if (endpoint.type === 'script') {
                     const result = await broker.call('automation.runScript', { 
                        scriptName: endpoint.target, 
                        context: { ...query, ...body, request: context.request } 
                    }, { request: context.request });
                     return { handled: true, response: this.success(result) };
                }

                if (endpoint.type === 'object_operation') {
                    // e.g. Proxy to an object action
                    if (endpoint.objectParams) {
                        const { object, operation } = endpoint.objectParams;
                        // Map standard CRUD operations
                        if (operation === 'find') {
                             const result = await broker.call('data.query', { object, query }, { request: context.request });
                             // Spec: FindDataResponse = { object, records, total?, hasMore? }
                             return { handled: true, response: this.success(result.records, { total: result.total }) };
                        }
                        if (operation === 'get' && query.id) {
                             const result = await broker.call('data.get', { object, id: query.id }, { request: context.request });
                             return { handled: true, response: this.success(result) };
                        }
                         if (operation === 'create') {
                             const result = await broker.call('data.create', { object, data: body }, { request: context.request });
                             return { handled: true, response: this.success(result) };
                        }
                    }
                }

                if (endpoint.type === 'proxy') {
                     // Simple proxy implementation (requires a network call, which usually is done by a service but here we can stub return)
                     // In real implementation this might fetch(endpoint.target)
                     // For now, return target info
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
