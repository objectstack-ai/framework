// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext, IHttpServer } from '@objectstack/core';
import { HttpDispatcher, HttpDispatcherResult } from './http-dispatcher.js';

export interface DispatcherPluginConfig {
    /**
     * API path prefix for all endpoints.
     * @default '/api/v1'
     */
    prefix?: string;
}

/**
 * Route definition emitted by service plugins (e.g. AIServicePlugin) via hooks.
 * Minimal interface — matches the shape produced by `buildAIRoutes()`.
 */
interface RouteDefinition {
    method: 'GET' | 'POST' | 'DELETE';
    path: string;
    description: string;
    handler: (req: any) => Promise<any>;
}

/**
 * Register a single RouteDefinition on the HTTP server.
 * Returns true if the route was successfully registered.
 */
function mountRouteOnServer(route: RouteDefinition, server: IHttpServer, routePath: string): boolean {
    const handler = async (req: any, res: any) => {
        try {
            const result = await route.handler({
                body: req.body,
                params: req.params,
                query: req.query,
            });

            if (result.stream && result.events) {
                // SSE streaming response
                res.status(result.status);

                // Apply headers from the route result if available
                if (result.headers) {
                    for (const [k, v] of Object.entries(result.headers)) {
                        res.header(k, String(v));
                    }
                } else {
                    res.header('Content-Type', 'text/event-stream');
                    res.header('Cache-Control', 'no-cache');
                    res.header('Connection', 'keep-alive');
                }

                // Write the stream — events are pre-encoded SSE strings
                if (typeof res.write === 'function' && typeof res.end === 'function') {
                    for await (const event of result.events) {
                        res.write(typeof event === 'string' ? event : `data: ${JSON.stringify(event)}\n\n`);
                    }
                    res.end();
                } else {
                    // Fallback: collect events into array
                    const events = [];
                    for await (const event of result.events) {
                        events.push(event);
                    }
                    res.json({ events });
                }
            } else {
                res.status(result.status);
                if (result.body !== undefined) {
                    res.json(result.body);
                } else {
                    res.end();
                }
            }
        } catch (err: any) {
            errorResponse(err, res);
        }
    };

    const m = route.method.toLowerCase();
    if (m === 'get' && typeof server.get === 'function') {
        server.get(routePath, handler);
        return true;
    } else if (m === 'post' && typeof server.post === 'function') {
        server.post(routePath, handler);
        return true;
    } else if (m === 'delete' && typeof server.delete === 'function') {
        server.delete(routePath, handler);
        return true;
    }
    return false;
}

/**
 * Send an HttpDispatcherResult through IHttpResponse.
 * Differentiates between handled, unhandled (404), and special results.
 */
function sendResult(result: HttpDispatcherResult, res: any): void {
    if (result.handled) {
        if (result.response) {
            res.status(result.response.status);
            if (result.response.headers) {
                for (const [k, v] of Object.entries(result.response.headers)) {
                    res.header(k, v);
                }
            }
            res.json(result.response.body);
            return;
        }
        if (result.result) {
            // Special results (redirect, stream) — pass through as JSON for now
            res.status(200).json(result.result);
            return;
        }
    }
    // Semantic 404: no route matched — include diagnostic info
    res.status(404).json({
        success: false,
        error: {
            message: 'Not Found',
            code: 404,
            type: 'ROUTE_NOT_FOUND',
            hint: 'No handler matched this request. Check the API discovery endpoint for available routes.',
        },
    });
}

function errorResponse(err: any, res: any): void {
    const code = err.statusCode || 500;
    res.status(code).json({
        success: false,
        error: { message: err.message || 'Internal Server Error', code },
    });
}

/**
 * Dispatcher Plugin
 *
 * Bridges legacy HttpDispatcher handlers to the IHttpServer route-registration model.
 * Registers routes for domains NOT covered by @objectstack/rest:
 *   - /.well-known/objectstack (discovery)
 *   - /auth      (authentication)
 *   - /graphql   (GraphQL)
 *   - /analytics (BI queries)
 *   - /packages  (package management)
 *   - /i18n      (internationalization — locales, translations, field labels)
 *   - /storage   (file storage)
 *   - /automation (CRUD + triggers + runs)
 *
 * Usage:
 * ```ts
 * import { createDispatcherPlugin } from '@objectstack/runtime';
 * runtime.use(createDispatcherPlugin({ prefix: '/api/v1' }));
 * ```
 */
export function createDispatcherPlugin(config: DispatcherPluginConfig = {}): Plugin {
    return {
        name: 'com.objectstack.runtime.dispatcher',
        version: '1.0.0',

        init: async (_ctx: PluginContext) => {
            // Consumer-only plugin — no services registered
        },

        start: async (ctx: PluginContext) => {
            let server: IHttpServer | undefined;
            try {
                server = ctx.getService<IHttpServer>('http.server');
            } catch {
                // No HTTP server available — skip silently
                return;
            }
            if (!server) return;

            const kernel = ctx.getKernel();
            const dispatcher = new HttpDispatcher(kernel);
            const prefix = config.prefix || '/api/v1';

            // ── Discovery (.well-known) ─────────────────────────────────
            server.get('/.well-known/objectstack', async (_req: any, res: any) => {
                res.json({ data: await dispatcher.getDiscoveryInfo(prefix) });
            });

            // ── Discovery (versioned API path) ──────────────────────────
            server.get(`${prefix}/discovery`, async (_req: any, res: any) => {
                res.json({ data: await dispatcher.getDiscoveryInfo(prefix) });
            });

            // ── Health ──────────────────────────────────────────────────
            server.get(`${prefix}/health`, async (_req: any, res: any) => {
                try {
                    const result = await dispatcher.dispatch('GET', '/health', undefined, {}, { request: _req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            // ── Auth ────────────────────────────────────────────────────
            server.post(`${prefix}/auth/login`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleAuth('login', 'POST', req.body, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            // ── GraphQL ─────────────────────────────────────────────────
            server.post(`${prefix}/graphql`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleGraphQL(req.body, { request: req });
                    res.json(result);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            // ── Analytics ───────────────────────────────────────────────
            server.post(`${prefix}/analytics/query`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleAnalytics('query', 'POST', req.body, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.get(`${prefix}/analytics/meta`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleAnalytics('meta', 'GET', {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.post(`${prefix}/analytics/sql`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleAnalytics('sql', 'POST', req.body, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            // ── Packages ────────────────────────────────────────────────
            server.get(`${prefix}/packages`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handlePackages('', 'GET', {}, req.query, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.post(`${prefix}/packages`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handlePackages('', 'POST', req.body, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.get(`${prefix}/packages/:id`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handlePackages(`/${req.params.id}`, 'GET', {}, req.query, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.delete(`${prefix}/packages/:id`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handlePackages(`/${req.params.id}`, 'DELETE', {}, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.patch(`${prefix}/packages/:id/enable`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handlePackages(`/${req.params.id}/enable`, 'PATCH', {}, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.patch(`${prefix}/packages/:id/disable`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handlePackages(`/${req.params.id}/disable`, 'PATCH', {}, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.post(`${prefix}/packages/:id/publish`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handlePackages(`/${req.params.id}/publish`, 'POST', req.body, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.post(`${prefix}/packages/:id/revert`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handlePackages(`/${req.params.id}/revert`, 'POST', req.body, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            // ── Cloud (Environments) ─────────────────────────────────────
            server.get(`${prefix}/cloud/drivers`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud('/drivers', 'GET', {}, req.query, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.get(`${prefix}/cloud/environments`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud('/environments', 'GET', {}, req.query, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.post(`${prefix}/cloud/environments`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud('/environments', 'POST', req.body, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.get(`${prefix}/cloud/environments/:id`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud(`/environments/${req.params.id}`, 'GET', {}, req.query, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.patch(`${prefix}/cloud/environments/:id`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud(`/environments/${req.params.id}`, 'PATCH', req.body, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.delete(`${prefix}/cloud/environments/:id`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud(`/environments/${req.params.id}`, 'DELETE', {}, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.post(`${prefix}/cloud/environments/:id/rotate-credential`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud(`/environments/${req.params.id}/rotate-credential`, 'POST', req.body, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.get(`${prefix}/cloud/environments/:id/members`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud(`/environments/${req.params.id}/members`, 'GET', {}, req.query, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            // ── Cloud — Per-env packages ─────────────────────────────────
            server.get(`${prefix}/cloud/environments/:id/packages`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud(`/environments/${req.params.id}/packages`, 'GET', {}, req.query, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.post(`${prefix}/cloud/environments/:id/packages`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud(`/environments/${req.params.id}/packages`, 'POST', req.body, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.get(`${prefix}/cloud/environments/:id/packages/:pkgId`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud(`/environments/${req.params.id}/packages/${req.params.pkgId}`, 'GET', {}, req.query, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.delete(`${prefix}/cloud/environments/:id/packages/:pkgId`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud(`/environments/${req.params.id}/packages/${req.params.pkgId}`, 'DELETE', {}, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.patch(`${prefix}/cloud/environments/:id/packages/:pkgId/enable`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud(`/environments/${req.params.id}/packages/${req.params.pkgId}/enable`, 'PATCH', {}, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.patch(`${prefix}/cloud/environments/:id/packages/:pkgId/disable`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud(`/environments/${req.params.id}/packages/${req.params.pkgId}/disable`, 'PATCH', {}, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.post(`${prefix}/cloud/environments/:id/packages/:pkgId/upgrade`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleCloud(`/environments/${req.params.id}/packages/${req.params.pkgId}/upgrade`, 'POST', req.body, {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            // ── Storage ─────────────────────────────────────────────────
            server.post(`${prefix}/storage/upload`, async (req: any, res: any) => {
                try {
                    // For file uploads the body *is* the file (parsed by adapter)
                    const result = await dispatcher.handleStorage('upload', 'POST', req.body, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.get(`${prefix}/storage/file/:id`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleStorage(`file/${req.params.id}`, 'GET', undefined, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            // ── i18n ────────────────────────────────────────────────────
            // Bridges to HttpDispatcher.handleI18n() which resolves the i18n
            // service from the kernel (either I18nServicePlugin or memory fallback).
            server.get(`${prefix}/i18n/locales`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleI18n('/locales', 'GET', req.query, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.get(`${prefix}/i18n/translations/:locale`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleI18n(`/translations/${req.params.locale}`, 'GET', req.query, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.get(`${prefix}/i18n/labels/:object/:locale`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleI18n(`/labels/${req.params.object}/${req.params.locale}`, 'GET', req.query, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            // ── Automation ──────────────────────────────────────────────
            server.get(`${prefix}/automation`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleAutomation('', 'GET', {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.post(`${prefix}/automation`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleAutomation('', 'POST', req.body, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.get(`${prefix}/automation/:name`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleAutomation(`${req.params.name}`, 'GET', {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.put(`${prefix}/automation/:name`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleAutomation(`${req.params.name}`, 'PUT', req.body, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.delete(`${prefix}/automation/:name`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleAutomation(`${req.params.name}`, 'DELETE', {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.post(`${prefix}/automation/trigger/:name`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleAutomation(`trigger/${req.params.name}`, 'POST', req.body, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.post(`${prefix}/automation/:name/trigger`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleAutomation(`${req.params.name}/trigger`, 'POST', req.body, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.post(`${prefix}/automation/:name/toggle`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleAutomation(`${req.params.name}/toggle`, 'POST', req.body, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.get(`${prefix}/automation/:name/runs`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleAutomation(`${req.params.name}/runs`, 'GET', {}, { request: req }, req.query);
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            server.get(`${prefix}/automation/:name/runs/:runId`, async (req: any, res: any) => {
                try {
                    const result = await dispatcher.handleAutomation(`${req.params.name}/runs/${req.params.runId}`, 'GET', {}, { request: req });
                    sendResult(result, res);
                } catch (err: any) {
                    errorResponse(err, res);
                }
            });

            ctx.logger.info('Dispatcher bridge routes registered', { prefix });

            // ── Dynamic service routes (AI, etc.) ───────────────────
            // Listen for route definitions emitted by service plugins.
            // The AIServicePlugin emits 'ai:routes' with RouteDefinition[].
            ctx.hook('ai:routes', async (routes: RouteDefinition[]) => {
                if (!server) return;
                for (const route of routes) {
                    // Strip the /api/v1 prefix if present (it's already in the path)
                    // and register on the HTTP server with the configured prefix.
                    const routePath = route.path.startsWith('/api/v1')
                        ? route.path
                        : `${prefix}${route.path}`;
                    mountRouteOnServer(route, server, routePath);
                }
                ctx.logger.info(`[Dispatcher] Registered ${routes.length} AI routes`);
            });

            // ── Fallback: recover routes cached before hook was registered ──
            // If AIServicePlugin.start() ran before DispatcherPlugin.start()
            // (possible when plugin start order differs from registration order),
            // the 'ai:routes' trigger fires with no listener. The AIServicePlugin
            // caches the routes on the kernel as __aiRoutes (see AIServicePlugin.start())
            // as an internal cross-plugin protocol so we can recover them here.
            // TODO: replace with a formal kernel.getCachedRoutes('ai') API in a future release.
            const cachedRoutes = (kernel as any).__aiRoutes as RouteDefinition[] | undefined;
            if (cachedRoutes && Array.isArray(cachedRoutes) && cachedRoutes.length > 0) {
                let registered = 0;
                for (const route of cachedRoutes) {
                    const routePath = route.path.startsWith('/api/v1')
                        ? route.path
                        : `${prefix}${route.path}`;
                    if (mountRouteOnServer(route, server, routePath)) {
                        registered++;
                    }
                }
                if (registered > 0) {
                    ctx.logger.info(`[Dispatcher] Recovered ${registered} cached AI routes (hook timing fallback)`);
                }
            }
        },
    };
}
