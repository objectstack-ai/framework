// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Cloud-side Artifact API plugin (P0 + P1).
 *
 * Thin assembler: resolves storage backend + driver, then delegates route
 * registration to the `routes/cloud.ts` and `routes/public.ts` modules.
 *
 *   P0 — Pluggable storage via {@link IStorageService} (fallback to local FS).
 *   P1 — Version history via `sys_environment_revision`, commit-aware GET, rollback.
 *
 * Routes registered:
 *   GET  /cloud/resolve-hostname?host=...
 *   GET  /cloud/projects/:id/artifact[?commit=...]
 *   POST /cloud/projects/:id/metadata
 *   GET  /cloud/projects/:id/revisions
 *   POST /cloud/projects/:id/revisions/:commit/activate
 *   POST /cloud/projects/:id/revisions/prune
 *   POST /cloud/packages                      — register/upsert a package (ADR-0006 v4 Phase B)
 *   POST /cloud/packages/:id/versions         — publish a new package version (ADR-0006 v4 Phase B)
 *   GET  /pub/v1/projects/:id/manifest.json
 *   GET  /pub/v1/projects/:id/artifact[?commit=&redirect=]
 *   GET  /pub/v1/projects/:id/revisions
 */

import type { IHttpServer, IDataDriver, IStorageService } from '@objectstack/spec/contracts';
import { resolveStorage } from './routes/storage.js';
import { registerCloudRoutes } from './routes/cloud.js';
import { registerPublicRoutes } from './routes/public.js';
import { registerBranchRoutes } from './routes/branches.js';
import { registerProjectLifecycleRoutes } from './routes/project-lifecycle.js';
import { registerPackageInstallRoutes } from './routes/package-install.js';
import { registerPackagePublishRoutes } from './routes/package-publish.js';
import type { ProjectTemplate } from './multi-project-plugin.js';
import type { RouteDeps } from './routes/types.js';

type AnyContext = any;

export interface CloudArtifactApiPluginOptions {
    /** Promise resolving to the control-plane driver. */
    controlDriverPromise: Promise<{ driver: IDataDriver; driverName: string; databaseUrl: string }>;
    /** API prefix (default `/api/v1`). */
    apiPrefix?: string;
    /** Filesystem root for relative `artifact_path` values (default `process.cwd()`). */
    artifactRoot?: string;
    /** Bearer token required on requests. */
    apiKey?: string;
    /** Pluggable storage backend. When omitted, tries kernel's `file-storage` service; falls back to local FS. */
    storage?: {
        service?: 'file-storage' | IStorageService;
        keyPrefix?: string;
    };
    /**
     * Template registry — used by the package-install route to lazy-snapshot
     * a starter template into `sys_package_version.manifest_json` on first
     * install. When omitted, install of un-snapshotted starter packages
     * will return 409.
     */
    templates?: Record<string, ProjectTemplate>;
}

export function createCloudArtifactApiPlugin(options: CloudArtifactApiPluginOptions): any {
    const prefix = options.apiPrefix ?? '/api/v1';
    const artifactRoot = options.artifactRoot ?? process.env.OS_PROJECT_ARTIFACT_ROOT ?? process.cwd();
    const requiredKey = options.apiKey ?? process.env.OS_CLOUD_API_KEY;
    const keyPrefix = options.storage?.keyPrefix ?? 'artifacts';

    return {
        name: 'com.objectstack.cloud.artifact-api',
        version: '2.0.0',
        init: async (_ctx: AnyContext) => {},
        start: async (ctx: AnyContext) => {
            let server: IHttpServer | undefined;
            try { server = ctx.getService('http.server') as IHttpServer | undefined; } catch { return; }
            if (!server) return;

            const { storage, adapterName: storageAdapterName } = resolveStorage(ctx, options, artifactRoot);

            // Best-effort better-auth session resolver. Cached on first use.
            let cachedAuthSvc: any | null | undefined;
            const headersFromReq = (req: any): any => {
                const raw = req?.headers;
                if (!raw) return new Headers();
                if (typeof raw.get === 'function') return raw;
                const h = new Headers();
                for (const [k, v] of Object.entries(raw as Record<string, any>)) {
                    if (v == null) continue;
                    h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
                }
                return h;
            };
            const getSessionData = async (req: any): Promise<any> => {
                if (cachedAuthSvc === undefined) {
                    try { cachedAuthSvc = ctx.getService?.('auth') ?? null; }
                    catch { cachedAuthSvc = null; }
                }
                if (!cachedAuthSvc) return null;
                try {
                    const apiObj = cachedAuthSvc.auth?.api ?? cachedAuthSvc.api;
                    if (!apiObj?.getSession) return null;
                    return await apiObj.getSession.call(apiObj, { headers: headersFromReq(req) });
                } catch { return null; }
            };
            const getCallerUserId = async (req: any) => (await getSessionData(req))?.user?.id;
            const getCallerActiveOrgId = async (req: any) => (await getSessionData(req))?.session?.activeOrganizationId;

            const deps: RouteDeps = {
                prefix,
                artifactRoot,
                keyPrefix,
                storage,
                storageAdapterName,
                requiredKey,
                controlDriverPromise: options.controlDriverPromise,
                getCallerUserId,
                getCallerActiveOrgId,
            };

            registerCloudRoutes(server, deps);
            registerPublicRoutes(server, deps);
            registerBranchRoutes(server, deps);
            registerProjectLifecycleRoutes(server, { ...deps, templates: options.templates });
            registerPackageInstallRoutes(server, { ...deps, templates: options.templates });
            registerPackagePublishRoutes(server, { ...deps, templates: options.templates });
        },
        stop: async (_ctx: AnyContext) => {},
    };
}
