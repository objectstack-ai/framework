// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Standalone (single-project) UX Plugin
 *
 * Registered when ObjectStack runs as a self-contained, single-project
 * deployment (default; `OBJECTSTACK_MODE` unset or `standalone`). Its
 * responsibility is **UI/route simplification only** — authentication is
 * handled by `plugin-auth` exactly as in multi-project mode.
 *
 * This plugin owns:
 *
 *  - `GET /api/v1/studio/runtime-config` → `{ singleProject: true, … }`
 *    so Studio hides the org/project switcher and uses unscoped REST routes.
 *  - `GET /api/v1/cloud/projects[/:id]` → a single synthetic project row
 *    (the standalone deployment doesn't have a real control-plane).
 *
 * It does **not** mock `/api/v1/auth/*`. There is no synthetic local user;
 * first-run flow goes through the Account SPA's `/setup` route which calls
 * better-auth's standard sign-up.
 *
 * Multi-project / cloud-mode counterparts live in `multi-project-plugins.ts`.
 */

import type { IHttpServer } from '@objectstack/spec/contracts';

// The runtime's PluginContext (with `getService`) lives in @objectstack/core,
// which isn't a direct dep of this app. Lifecycle hooks accept the full
// context via `any` — the surrounding plugins in this config already follow
// the same pattern (see control-plane-preset.ts).
type AnyContext = any;

export const DEFAULT_LOCAL_ORG_ID = 'org_local';
export const DEFAULT_LOCAL_PROJECT_ID = 'proj_local';

export interface SingleProjectPluginOptions {
    orgId?: string;
    projectId?: string;
    /**
     * Owner user id used as the synthetic `created_by` in the `/cloud/projects`
     * placeholder rows. The real owner is whatever user signs up via the
     * Account SPA's `/setup` flow; this is purely cosmetic for the
     * project-row response shape.
     */
    ownerUserId?: string;
    /** Display name for the standalone organization in the project row. */
    orgName?: string;
    apiPrefix?: string;
}

export function createSingleProjectPlugin(options: SingleProjectPluginOptions = {}): any {
    const orgId = options.orgId ?? DEFAULT_LOCAL_ORG_ID;
    const projectId = options.projectId ?? DEFAULT_LOCAL_PROJECT_ID;
    const ownerUserId = options.ownerUserId ?? '';
    const orgName = options.orgName ?? 'Local';
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

            // Studio runtime-config — the standalone signal tells the SPA to
            // hide org/project switchers and use unscoped REST routes.
            // Authentication is *not* skipped: every request still goes
            // through better-auth. Studio always shows the real session, and
            // unauthenticated users are redirected to the Account login page.
            server.get(`${prefix}/studio/runtime-config`, async (_req: any, res: any) => {
                res.json({
                    singleProject: true,
                    defaultOrgId: orgId,
                    defaultProjectId: projectId,
                });
            });

            // Control-plane projects API — dispatcher-plugin shape
            // (`{ success, data: { projects, total }, meta }`). One synthetic
            // record is enough: the frontend derives `:projectId` from config.
            server.get(`${prefix}/cloud/projects`, async (_req: any, res: any) => {
                res.json({
                    success: true,
                    data: {
                        projects: [buildLocalProjectRow(orgId, projectId, ownerUserId)],
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
                        project: buildLocalProjectRow(orgId, projectId, ownerUserId),
                        organization: { id: orgId, name: orgName },
                    },
                });
            });
        },

        stop: async (_ctx: AnyContext) => {
            // http.server routes are torn down by the server plugin.
        },
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
