// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Public, unauthenticated `/pub/v1/projects/:id/*` routes.
 *
 *   GET /pub/v1/projects/:id/manifest.json
 *   GET /pub/v1/projects/:id/artifact[?commit=...][&redirect=1]
 *   GET /pub/v1/projects/:id/revisions
 *
 * Visibility model (post-`unlisted`-merge):
 *   `public`  → listed; anonymous download of any/current revision; enumerable.
 *   `private` → hidden from enumeration; anonymous download ONLY with an
 *               exact `?commit=<id>` (share-by-link). Members still get
 *               full authenticated access via `/cloud/projects/:id/*`.
 *   (Legacy `unlisted` rows are coerced to `private`.)
 *
 * Responses are content-addressable and immutable per commitId, so we set
 * strong caching headers — a CDN in front of this server (Cloudflare,
 * CloudFront, …) can serve everything from the edge.
 */

import type { IHttpServer } from '@objectstack/spec/contracts';
import { ok, fail } from '../cloud-artifact-helpers.js';
import type { SysProjectRow } from '../cloud-artifact-helpers.js';
import type { RouteDeps } from './types.js';
import { makeGetDriver, controlPlaneUnavailable } from './types.js';

type VisibilityCheck = { ok: true } | { ok: false; status: number; body: any };

function checkVisibility(project: SysProjectRow, requestedCommit: string): VisibilityCheck {
    const raw = project.visibility ?? 'private';
    const visibility = raw === 'unlisted' ? 'private' : raw;
    if (visibility === 'private' && !requestedCommit) {
        return { ok: false, status: 404, body: fail('not found', 404) };
    }
    return { ok: true };
}

export function registerPublicRoutes(server: IHttpServer, deps: RouteDeps): void {
    const { prefix, storage, controlDriverPromise } = deps;
    const getDriver = makeGetDriver(controlDriverPromise);
    const publicPrefix = `${prefix}/pub/v1/projects/:id`;

    // GET /pub/v1/projects/:id/manifest.json — lightweight project info
    server.get(`${publicPrefix}/manifest.json`, async (req: any, res: any) => {
        const projectId = String(req.params?.id ?? '').trim();
        if (!projectId) return res.status(404).json(fail('not found', 404));

        const driver = await getDriver();
        if (!driver) return controlPlaneUnavailable(res);

        const project = (await (driver.findOne as any)('sys_environment', { where: { id: projectId } })) as SysProjectRow | null;
        if (!project) return res.status(404).json(fail('not found', 404));

        // For manifest we only expose `public` (no enumeration of `private`).
        if ((project.visibility ?? 'private') !== 'public') {
            return res.status(404).json(fail('not found', 404));
        }

        const current = await (driver.findOne as any)('sys_project_revision_DEPRECATED', {
            where: { environment_id: projectId, is_current: true },
        });

        if (typeof res.set === 'function') {
            res.set('Cache-Control', 'public, max-age=60');
        }
        return res.json(ok({
            projectId: project.id,
            organizationId: project.organization_id,
            displayName: (project as any).display_name ?? null,
            visibility: project.visibility,
            currentCommitId: current?.commit_id ?? null,
            currentChecksum: current?.checksum ?? null,
            builtAt: current?.built_at ?? null,
        }));
    });

    // GET /pub/v1/projects/:id/artifact[?commit=...]
    server.get(`${publicPrefix}/artifact`, async (req: any, res: any) => {
        const projectId = String(req.params?.id ?? '').trim();
        if (!projectId) return res.status(404).json(fail('not found', 404));

        const driver = await getDriver();
        if (!driver) return controlPlaneUnavailable(res);

        const project = (await (driver.findOne as any)('sys_environment', { where: { id: projectId } })) as SysProjectRow | null;
        if (!project) return res.status(404).json(fail('not found', 404));

        const requestedCommit = String(req.query?.commit ?? '').trim();
        const vis = checkVisibility(project, requestedCommit);
        if (!vis.ok) return res.status(vis.status).json(vis.body);

        let rev: any = null;
        try {
            if (requestedCommit) {
                rev = await (driver.findOne as any)('sys_project_revision_DEPRECATED', {
                    where: { environment_id: projectId, commit_id: requestedCommit },
                });
            } else {
                rev = await (driver.findOne as any)('sys_project_revision_DEPRECATED', {
                    where: { environment_id: projectId, is_current: true },
                });
            }
        } catch { /* no revision table yet */ }

        if (!rev?.storage_key) return res.status(404).json(fail('not found', 404));

        const exists = await storage.exists(rev.storage_key);
        if (!exists) return res.status(404).json(fail('not found', 404));

        // Optional: skip the proxy and redirect the caller to a short-lived
        // signed URL (S3 / R2). This offloads bandwidth from the control
        // plane. Triggered by `?redirect=1` and only when the configured
        // storage adapter supports `getSignedUrl`.
        const wantRedirect = req.query?.redirect === '1' || req.query?.redirect === 'true';
        if (wantRedirect && typeof storage.getSignedUrl === 'function') {
            try {
                const signed = await storage.getSignedUrl(rev.storage_key, 300);
                if (signed) {
                    if (typeof res.set === 'function') {
                        res.set('Cache-Control', 'private, max-age=60');
                        res.set('X-Commit-Id', rev.commit_id);
                    }
                    return res.redirect(302, signed);
                }
            } catch (signErr: any) {
                console.warn('[CloudArtifactAPI] getSignedUrl failed, falling back to inline:', signErr?.message);
            }
        }

        const buf = await storage.download(rev.storage_key);
        const body = JSON.parse(buf.toString('utf-8'));

        // Always emit a consistent envelope, even if the stored bundle
        // is "bare" (no top-level commitId/checksum). The revision row
        // is authoritative for identity.
        const envelope = {
            schemaVersion: body.schemaVersion ?? '0.1',
            projectId: project.id,
            commitId: rev.commit_id,
            checksum: rev.checksum,
            metadata: body.metadata ?? body,
            functions: Array.isArray(body.functions) ? body.functions : [],
            manifest: body.manifest ?? { plugins: [], drivers: [], engines: {} },
            builtAt: rev.built_at ?? body.builtAt ?? null,
        };

        if (typeof res.set === 'function') {
            // commitId is a content-hash → safe to cache forever.
            res.set('Cache-Control', 'public, max-age=31536000, immutable');
            res.set('ETag', `"${rev.commit_id}"`);
            res.set('X-Commit-Id', rev.commit_id);
        }
        return res.json(ok(envelope));
    });

    // GET /pub/v1/projects/:id/revisions — public history (only for `public`)
    server.get(`${publicPrefix}/revisions`, async (req: any, res: any) => {
        const projectId = String(req.params?.id ?? '').trim();
        if (!projectId) return res.status(404).json(fail('not found', 404));

        const driver = await getDriver();
        if (!driver) return controlPlaneUnavailable(res);

        const project = (await (driver.findOne as any)('sys_environment', { where: { id: projectId } })) as SysProjectRow | null;
        if (!project) return res.status(404).json(fail('not found', 404));

        // Listing reveals history → only allow on `public`.
        if ((project.visibility ?? 'private') !== 'public') {
            return res.status(404).json(fail('not found', 404));
        }

        const limit = Math.min(Math.max(Number(req.query?.limit ?? 20), 1), 100);
        let rows: any[] = [];
        try {
            rows = (await (driver.find as any)('sys_project_revision_DEPRECATED', {
                where: { environment_id: projectId },
                orderBy: [{ field: 'published_at', direction: 'desc' }],
                limit,
            })) ?? [];
        } catch { /* no revision table */ }

        if (typeof res.set === 'function') {
            res.set('Cache-Control', 'public, max-age=30');
        }
        return res.json(ok({
            items: rows.map((r) => ({
                commitId: r.commit_id,
                checksum: r.checksum,
                sizeBytes: r.size_bytes,
                builtAt: r.built_at,
                publishedAt: r.published_at,
                note: r.note,
                isCurrent: !!r.is_current,
            })),
        }));
    });
}
