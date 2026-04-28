// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Project-mode bootstrap plugin.
 *
 * Registered when ObjectStack runs in `project` mode (default — single
 * project, local SQLite, but reusing the cloud plugin stack). It is a thin
 * companion to `createCloudStack()`:
 *
 *   1. **Idempotent identity seed** — writes the local `sys_organization`
 *      and `sys_project` rows to the control-plane DB on every boot. Once
 *      seeded, `KernelManager` resolves `proj_local` via real database
 *      lookups — exactly as in cloud mode.
 *
 *   2. **Studio runtime-config signal** — exposes
 *      `GET /api/v1/studio/runtime-config` returning
 *      `{ singleProject: true, defaultOrgId, defaultProjectId }`. Phase 2
 *      of the mode refactor will replace this with a data-driven UI
 *      (org switcher hidden when `useOrganizations()` returns one row);
 *      until then the SPA still depends on this flag.
 *
 * It does NOT mock `/cloud/projects`, `/cloud/organizations`, or `/auth/*`
 * — those routes are served by real plugins backed by the seeded control
 * plane.
 */

import type { IHttpServer } from '@objectstack/spec/contracts';

// PluginContext lives in @objectstack/core which isn't a direct dep of this
// app. Lifecycle hooks accept the full context via `any` to match the rest
// of the host plugins (see control-plane-preset.ts).
type AnyContext = any;

export const DEFAULT_LOCAL_ORG_ID = 'org_local';
export const DEFAULT_LOCAL_PROJECT_ID = 'proj_local';

export interface SingleProjectPluginOptions {
    orgId?: string;
    projectId?: string;
    /** Display name written to the seeded `sys_organization`. */
    orgName?: string;
    apiPrefix?: string;
    /** Project DB URL stored in `sys_project.database_url`. */
    projectDatabaseUrl?: string;
    /** Driver name for the project DB (e.g. `sqlite`, `turso`). */
    projectDatabaseDriver?: string;
}

export function createSingleProjectPlugin(options: SingleProjectPluginOptions = {}): any {
    const orgId = options.orgId ?? DEFAULT_LOCAL_ORG_ID;
    const projectId = options.projectId ?? DEFAULT_LOCAL_PROJECT_ID;
    const orgName = options.orgName ?? 'Local';
    const prefix = options.apiPrefix ?? '/api/v1';

    return {
        name: 'com.objectstack.studio.single-project',
        version: '2.0.0',

        init: async (_ctx: AnyContext) => {
            // No services registered. Identity seed runs in `start()` once
            // ObjectQL has finished loading the control-plane schema.
        },

        start: async (ctx: AnyContext) => {
            // ── 1. Idempotent identity seed ──────────────────────────────
            if (options.projectDatabaseUrl) {
                let objectql: any;
                try {
                    objectql = ctx.getService('objectql');
                } catch {
                    // ObjectQL not registered yet — control-plane preset must
                    // run first; if that's not the case we skip silently.
                }
                if (objectql) {
                    const { ensureLocalIdentity } = await import('./ensure-local-identity.js');
                    await ensureLocalIdentity({
                        objectql,
                        orgId,
                        projectId,
                        orgName,
                        projectDatabaseUrl: options.projectDatabaseUrl,
                        projectDatabaseDriver: options.projectDatabaseDriver ?? 'sqlite',
                    });
                }
            }

            // ── 2. Studio runtime-config (single-project signal) ─────────
            //
            // This route is registered AFTER the cloud preset's
            // `createStudioRuntimeConfigPlugin` (which returns
            // `{ singleProject: false }`). HttpServer route registration is
            // last-write-wins for matching paths in our adapter, so this
            // override correctly flips the SPA into single-project mode.
            let server: IHttpServer | undefined;
            try {
                server = ctx.getService('http.server') as IHttpServer | undefined;
            } catch {
                return;
            }
            if (!server) return;

            server.get(`${prefix}/studio/runtime-config`, async (_req: any, res: any) => {
                res.json({
                    singleProject: true,
                    defaultOrgId: orgId,
                    defaultProjectId: projectId,
                });
            });
        },

        stop: async (_ctx: AnyContext) => {
            // http.server routes are torn down by the server plugin.
        },
    };
}
