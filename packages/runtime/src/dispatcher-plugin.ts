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
 * Send an HttpDispatcherResult through IHttpResponse
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
    res.status(404).json({ success: false, error: { message: 'Not Found', code: 404 } });
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
        },
    };
}
