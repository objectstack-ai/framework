// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Multi-Project / Cloud auxiliary route plugins.
 *
 * Counterpart to `single-project-plugin.ts`. These plugins are registered
 * only when the server runs in cloud mode (`OBJECTSTACK_MODE=cloud`,
 * e.g. the Vercel deployment behind play.objectstack.ai). They expose two
 * Studio-facing endpoints:
 *
 *   - `GET /api/v1/studio/runtime-config` → `{ singleProject: false }`
 *     so the SPA initRuntimeConfig() handshake doesn't 404 and falls
 *     through to the org/project picker.
 *
 *   - `GET /api/v1/cloud/templates` → static list from the template
 *     registry. Bypasses the dispatcher's `template-seeder` service
 *     indirection, which silently returned `{templates:[],total:0}` on
 *     Vercel cold starts when MultiProjectPlugin's service registration
 *     races the request.
 *
 * Both plugins register their routes on `http.server` *before*
 * DispatcherPlugin, so they win the route match.
 */

import type { IHttpServer } from '@objectstack/spec/contracts';

type AnyContext = any;

/**
 * Returns `{ singleProject: false }` so the SPA's `initRuntimeConfig()`
 * handshake succeeds in multi-project mode without 404 noise.
 */
export function createStudioRuntimeConfigPlugin(options: { apiPrefix?: string } = {}): any {
    const prefix = options.apiPrefix ?? '/api/v1';
    return {
        name: 'com.objectstack.studio.runtime-config',
        version: '1.0.0',
        init: async (_ctx: AnyContext) => {},
        start: async (ctx: AnyContext) => {
            let server: IHttpServer | undefined;
            try {
                server = ctx.getService('http.server') as IHttpServer | undefined;
            } catch {
                return;
            }
            if (!server) return;
            server.get(`${prefix}/studio/runtime-config`, async (_req: any, res: any) => {
                res.json({ singleProject: false });
            });
        },
        stop: async (_ctx: AnyContext) => {},
    };
}

/**
 * Direct `/cloud/templates` route. Serves a snapshot of the template
 * registry captured at config-load time, so SPA always receives the
 * full list even before per-project kernels finish provisioning.
 */
export function createTemplatesRoutePlugin(
    templates: Array<{ id: string; label: string; description: string; category?: string }>,
    options: { apiPrefix?: string } = {},
): any {
    const prefix = options.apiPrefix ?? '/api/v1';
    const payload = templates.map(({ id, label, description, category }) => ({
        id,
        label,
        description,
        category,
    }));
    return {
        name: 'com.objectstack.studio.templates-route',
        version: '1.0.0',
        init: async (_ctx: AnyContext) => {},
        start: async (ctx: AnyContext) => {
            let server: IHttpServer | undefined;
            try {
                server = ctx.getService('http.server') as IHttpServer | undefined;
            } catch {
                return;
            }
            if (!server) return;
            server.get(`${prefix}/cloud/templates`, async (_req: any, res: any) => {
                res.json({
                    success: true,
                    data: { templates: payload, total: payload.length },
                });
            });
        },
        stop: async (_ctx: AnyContext) => {},
    };
}
