// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Single-Project Short-Circuit Plugin
 *
 * Registered only when `OBJECTSTACK_MULTI_PROJECT` is unset/false. It
 * exposes the handful of endpoints Studio polls to decide whether to
 * render its org/project chrome, returning synthetic responses shaped
 * to satisfy `packages/client`, `apps/studio/src/hooks/useSession.ts`,
 * and `useProjects.ts`. Routes are registered on the shared
 * `http.server` service *before* DispatcherPlugin, so they win the
 * match against the control-plane `/cloud/projects*` handlers.
 */

import type { IHttpServer } from '@objectstack/spec/contracts';

// The runtime's PluginContext (with `getService`) lives in @objectstack/core,
// which isn't a direct dep of this app. Lifecycle hooks accept the full
// context via `any` — the surrounding plugins in this config already follow
// the same pattern (see control-plane-preset.ts).
type AnyContext = any;

export const DEFAULT_LOCAL_ORG_ID = 'org_local';
export const DEFAULT_LOCAL_PROJECT_ID = 'proj_local';
export const DEFAULT_LOCAL_USER_ID = 'user_local';

export interface SingleProjectPluginOptions {
    orgId?: string;
    projectId?: string;
    userId?: string;
    apiPrefix?: string;
}

export function createSingleProjectPlugin(options: SingleProjectPluginOptions = {}): any {
    const orgId = options.orgId ?? DEFAULT_LOCAL_ORG_ID;
    const projectId = options.projectId ?? DEFAULT_LOCAL_PROJECT_ID;
    const userId = options.userId ?? DEFAULT_LOCAL_USER_ID;
    const prefix = options.apiPrefix ?? '/api/v1';

    return {
        name: 'com.objectstack.studio.single-project',
        version: '1.0.0',

        init: async (_ctx: AnyContext) => {
            // No services registered — consumer of http.server only.
        },

        start: async (ctx: AnyContext) => {
            let server: IHttpServer | undefined;
            try {
                server = ctx.getService('http.server') as IHttpServer | undefined;
            } catch {
                return;
            }
            if (!server) return;

            // Studio runtime-config — used by apps/studio/src/lib/config.ts
            // initRuntimeConfig() to decide whether to hide the org/project
            // chrome and skip auth.
            server.get(`${prefix}/studio/runtime-config`, async (_req: any, res: any) => {
                res.json({
                    singleProject: true,
                    defaultOrgId: orgId,
                    defaultProjectId: projectId,
                    skipAuth: true,
                });
            });

            // better-auth session — `useSession()` calls `client.auth.me()` which
            // hits this path; `normaliseSessionResponse` accepts both
            // `{ user, session }` and `{ data: { user, session } }`. We emit
            // the `data`-wrapped shape to match what better-auth returns.
            server.get(`${prefix}/auth/get-session`, async (_req: any, res: any) => {
                res.json({
                    data: {
                        user: {
                            id: userId,
                            email: 'local@objectstack.dev',
                            name: 'Local',
                            emailVerified: true,
                        },
                        session: {
                            id: 'session_local',
                            userId,
                            activeOrganizationId: orgId,
                        },
                    },
                });
            });

            // better-auth organization/list — `client.organizations.list()`
            // accepts either a raw array or `{ data: [...] }`.
            server.get(`${prefix}/auth/organization/list`, async (_req: any, res: any) => {
                res.json([
                    { id: orgId, name: 'Local', slug: 'local' },
                ]);
            });

            // Control-plane projects API — dispatcher-plugin shape
            // (`{ success, data: { projects, total }, meta }`). One synthetic
            // record is enough: the frontend derives `:projectId` from config.
            server.get(`${prefix}/cloud/projects`, async (_req: any, res: any) => {
                res.json({
                    success: true,
                    data: {
                        projects: [buildLocalProjectRow(orgId, projectId, userId)],
                        total: 1,
                    },
                });
            });

            server.get(`${prefix}/cloud/projects/:id`, async (req: any, res: any) => {
                const id = req.params?.id;
                if (id !== projectId) {
                    if (typeof res.status === 'function') {
                        res.status(404).json({
                            success: false,
                            error: { code: 404, message: `Project ${id} not found` },
                        });
                    } else {
                        res.json({
                            success: false,
                            error: { code: 404, message: `Project ${id} not found` },
                        });
                    }
                    return;
                }
                res.json({
                    success: true,
                    data: {
                        project: buildLocalProjectRow(orgId, projectId, userId),
                        organization: { id: orgId, name: 'Local' },
                    },
                });
            });
        },

        stop: async (_ctx: AnyContext) => {
            // http.server routes are torn down by the server plugin.
        },
    };
}

/**
 * Multi-project / cloud variant: only registers `/studio/runtime-config`,
 * returning `{ singleProject: false }` so the SPA falls through to the
 * org/project picker. Avoids a 404 in the Network panel without affecting
 * any actual control-plane behaviour.
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

function buildLocalProjectRow(orgId: string, projectId: string, userId: string): Record<string, unknown> {
    const now = new Date().toISOString();
    return {
        id: projectId,
        organization_id: orgId,
        display_name: 'Local',
        is_default: true,
        is_system: false,
        status: 'active',
        created_by: userId,
        created_at: now,
        updated_at: now,
        metadata: {},
    };
}
