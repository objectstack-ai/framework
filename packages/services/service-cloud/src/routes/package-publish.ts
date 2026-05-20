// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Package publish routes — CLI / "upload my local package to my org" loop.
 *
 *   POST /cloud/packages
 *     body: {
 *       manifest_id: string                // reverse-domain id (e.g. local.acme.crm)
 *       display_name?: string
 *       description?: string
 *       visibility?: 'private' | 'org' | 'marketplace'   (default: 'private')
 *       category?: string
 *       owner_org_id?: string              // required in service (bearer) mode
 *     }
 *     Effect: idempotent upsert of one sys_package row keyed by manifest_id.
 *     - User mode (session cookie): owner_org_id = session.activeOrganizationId
 *     - Service mode (bearer key):  owner_org_id = body.owner_org_id (required)
 *     - Existing rows are matched by (manifest_id) and patched with non-null
 *       fields from the body. Ownership is NEVER reassigned by upsert.
 *
 *   POST /cloud/packages/:id/versions
 *     :id may be either the sys_package UUID or the manifest_id (slug).
 *     body: {
 *       version: string                    // semver, required
 *       bundle: object | string            // compiled artifact (objectstack.json)
 *                                          // or pre-shaped manifest snapshot
 *       release_notes?: string
 *       is_pre_release?: boolean
 *       install_env_id?: string            // optional: auto-install into env
 *       seed_sample_data?: boolean         // forwarded to install if set
 *     }
 *     Effect:
 *       1. Verify caller can publish into the target package (owner_org match).
 *       2. Snapshot the bundle into the manifest_json shape understood by
 *          MultiProjectPlugin (top-level id/name/version + KNOWN_METADATA_CATEGORIES).
 *       3. INSERT a new sys_package_version row (status='published').
 *          (package_id, version) is UNIQUE — duplicate publishes are rejected.
 *       4. If install_env_id is set, UPSERT sys_package_installation pointing
 *          the env at the new version (same code path as marketplace install).
 *
 * This is the missing half of the unified Package flow described in
 * ADR-0006 v4 — once all CLI publishes flow through these endpoints,
 * `sys_environment_revision` becomes redundant and can be retired.
 */

import { createHash, randomUUID } from 'node:crypto';
import type { IHttpServer, IDataDriver } from '@objectstack/spec/contracts';
import { fail, ok, KNOWN_METADATA_CATEGORIES } from '../cloud-artifact-helpers.js';
import type { RouteDeps } from './types.js';
import { makeCheckAuth, makeGetDriver, controlPlaneUnavailable } from './types.js';
import type { PackageInstallDeps } from './package-install.js';
import { installPackageIntoEnvironment } from './package-install.js';

const VALID_VISIBILITY = new Set(['private', 'org', 'marketplace']);
const MANIFEST_ID_RE = /^[a-z0-9][a-z0-9._-]{0,254}$/i;

function nowIso(): string {
    return new Date().toISOString();
}

function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

/**
 * Look up a sys_package by either its UUID id or its manifest_id slug.
 * UUIDs are matched first (cheap, indexed) before the slug fallback.
 */
async function findPackageByIdOrManifest(
    driver: IDataDriver,
    idOrManifest: string,
): Promise<any | null> {
    if (!idOrManifest) return null;
    const byId: any = await (driver as any).findOne?.('sys_package', { where: { id: idOrManifest } });
    if (byId) return byId;
    const byManifest: any = await (driver as any).findOne?.('sys_package', { where: { manifest_id: idOrManifest } });
    return byManifest ?? null;
}

/**
 * Build a portable manifest snapshot from a CLI artifact bundle.
 * Mirrors the snapshot shape produced by `package-install.ts::snapshotManifest`
 * so the multi-project-plugin loader can consume either source uniformly.
 *
 * The incoming bundle can be either:
 *   - the raw compiled artifact ({ manifest, metadata: {...}, objects: [...], ... })
 *   - an already-shaped manifest snapshot (flat top-level categories)
 */
export function snapshotBundleAsManifest(args: {
    manifestId: string;
    displayName?: string;
    description?: string;
    category?: string;
    version: string;
    bundle: any;
}): { json: string; checksum: string } {
    const { manifestId, displayName, description, category, version, bundle } = args;
    const safe: Record<string, any> = {
        id: manifestId,
        name: displayName ?? bundle?.manifest?.name ?? manifestId,
        description: description ?? bundle?.manifest?.description ?? undefined,
        category: category ?? bundle?.manifest?.category ?? 'app',
        version,
    };

    // Collect per-category arrays from either the flat top level or a nested
    // `metadata` envelope (mergeArtifactMetadata accepts both shapes too).
    const sources: any[] = [];
    if (bundle && typeof bundle === 'object') {
        if (bundle.metadata && typeof bundle.metadata === 'object' && !Array.isArray(bundle.metadata)) {
            sources.push(bundle.metadata);
        }
        sources.push(bundle);
    }

    for (const key of KNOWN_METADATA_CATEGORIES) {
        for (const src of sources) {
            const val = src?.[key];
            if (Array.isArray(val) && val.length > 0) {
                const bucket = (safe[key] ??= []) as any[];
                bucket.push(...val);
            }
        }
    }
    // Translations may live under either `translations` or `i18n`.
    if (!safe.translations) {
        for (const src of sources) {
            if (src?.i18n) {
                safe.translations = src.i18n;
                break;
            }
        }
    }

    const json = JSON.stringify(safe);
    const checksum = sha256Hex(json);
    return { json, checksum };
}

export function registerPackagePublishRoutes(server: IHttpServer, deps: PackageInstallDeps): void {
    const { prefix, requiredKey, controlDriverPromise, getCallerUserId, getCallerActiveOrgId } = deps;
    const checkAuth = makeCheckAuth(requiredKey, getCallerUserId);
    const getDriver = makeGetDriver(controlDriverPromise);

    // ================================================================
    // POST /cloud/packages
    //   Idempotent upsert by manifest_id. Creates a sys_package row if
    //   none exists; otherwise patches non-ownership fields.
    // ================================================================
    server.post(`${prefix}/cloud/packages`, async (req: any, res: any) => {
        const auth = await checkAuth(req);
        if (!auth.ok) return res.status(auth.status).json(auth.body);

        const driver = await getDriver();
        if (!driver) return controlPlaneUnavailable(res);

        const body = (req.body ?? {}) as Record<string, any>;
        const manifestId = String(body.manifest_id ?? body.manifestId ?? '').trim();
        if (!manifestId) return res.status(400).json(fail('manifest_id is required'));
        if (!MANIFEST_ID_RE.test(manifestId)) {
            return res.status(400).json(fail(
                'manifest_id must match /^[a-z0-9][a-z0-9._-]{0,254}$/i (reverse-domain style, e.g. local.acme.crm)',
            ));
        }

        const visibility = body.visibility ? String(body.visibility) : 'private';
        if (!VALID_VISIBILITY.has(visibility)) {
            return res.status(400).json(fail(`visibility must be one of: ${[...VALID_VISIBILITY].join(', ')}`));
        }

        // Resolve owner org. User-mode uses session.activeOrganizationId;
        // service-mode (bearer) requires an explicit owner_org_id in the body
        // since there's no session context. Marketplace publishes can omit it
        // (platform-seeded packages use owner_org_id NULL).
        let ownerOrgId: string | null = null;
        if (auth.mode === 'user' && getCallerActiveOrgId) {
            ownerOrgId = (await getCallerActiveOrgId(req)) ?? null;
            if (!ownerOrgId) {
                return res.status(400).json(fail(
                    'No active organization on session. Switch to an organization in the Console before publishing.',
                ));
            }
        } else if (auth.mode === 'service') {
            const explicit = body.owner_org_id ?? body.ownerOrgId;
            ownerOrgId = explicit != null ? String(explicit) : null;
            if (!ownerOrgId && visibility !== 'marketplace') {
                return res.status(400).json(fail(
                    'owner_org_id is required in service mode (Authorization: Bearer …) when visibility is not marketplace',
                ));
            }
        }

        const existing: any = await (driver as any).findOne?.('sys_package', { where: { manifest_id: manifestId } });

        if (existing) {
            // Don't reassign ownership on upsert — protects against accidental
            // takeover of someone else's manifest_id. Caller must own it (or
            // be in service mode, which is implicitly trusted).
            if (auth.mode === 'user' && ownerOrgId && existing.owner_org_id && existing.owner_org_id !== ownerOrgId) {
                return res.status(403).json(fail(
                    `Package '${manifestId}' is owned by another organization`,
                ));
            }

            const patch: Record<string, any> = { updated_at: nowIso() };
            if (typeof body.display_name === 'string') patch.display_name = body.display_name;
            if (typeof body.description === 'string') patch.description = body.description;
            if (typeof body.category === 'string') patch.category = body.category;
            if (typeof body.icon_url === 'string') patch.icon_url = body.icon_url;
            if (typeof body.homepage_url === 'string') patch.homepage_url = body.homepage_url;
            if (typeof body.license === 'string') patch.license = body.license;
            if (typeof body.readme === 'string') patch.readme = body.readme;
            if (body.visibility) patch.visibility = visibility;
            await (driver as any).update?.('sys_package', existing.id, patch);

            return res.json(ok({
                id: existing.id,
                manifest_id: manifestId,
                created: false,
                owner_org_id: existing.owner_org_id,
                visibility: patch.visibility ?? existing.visibility,
            }));
        }

        // Create fresh sys_package row
        const id = `pkg_${randomUUID()}`;
        const row: Record<string, any> = {
            id,
            created_at: nowIso(),
            updated_at: nowIso(),
            manifest_id: manifestId,
            owner_org_id: ownerOrgId ?? undefined,
            display_name: typeof body.display_name === 'string' && body.display_name.trim()
                ? body.display_name.trim()
                : manifestId,
            description: typeof body.description === 'string' ? body.description : undefined,
            visibility,
            category: typeof body.category === 'string' ? body.category : undefined,
            icon_url: typeof body.icon_url === 'string' ? body.icon_url : undefined,
            homepage_url: typeof body.homepage_url === 'string' ? body.homepage_url : undefined,
            license: typeof body.license === 'string' ? body.license : undefined,
            readme: typeof body.readme === 'string' ? body.readme : undefined,
            publisher: 'private',
            is_starter: false,
            created_by: auth.mode === 'user' ? auth.userId : undefined,
        };
        await (driver as any).create?.('sys_package', row);

        return res.json(ok({
            id,
            manifest_id: manifestId,
            created: true,
            owner_org_id: ownerOrgId,
            visibility,
        }));
    });

    // ================================================================
    // POST /cloud/packages/:id/versions
    //   Snapshot the supplied bundle into sys_package_version. Optionally
    //   auto-install into the target environment.
    // ================================================================
    server.post(`${prefix}/cloud/packages/:id/versions`, async (req: any, res: any) => {
        const auth = await checkAuth(req);
        if (!auth.ok) return res.status(auth.status).json(auth.body);

        const driver = await getDriver();
        if (!driver) return controlPlaneUnavailable(res);

        const idOrManifest = String(req.params?.id ?? '').trim();
        if (!idOrManifest) return res.status(400).json(fail('package id (or manifest_id) is required'));

        const pkg = await findPackageByIdOrManifest(driver, idOrManifest);
        if (!pkg) return res.status(404).json(fail(`Package '${idOrManifest}' not found`));

        // User-mode RBAC: only the owning org may publish new versions
        // (marketplace packages also require owner_org match — only the
        // publisher can roll a new version).
        if (auth.mode === 'user' && getCallerActiveOrgId) {
            const activeOrg = await getCallerActiveOrgId(req);
            if (pkg.owner_org_id && activeOrg && pkg.owner_org_id !== activeOrg) {
                return res.status(403).json(fail('You do not own this package'));
            }
        }

        const body = (req.body ?? {}) as Record<string, any>;
        const version = String(body.version ?? '').trim();
        if (!version) return res.status(400).json(fail('version is required (semver string)'));

        const bundle = body.bundle ?? body.manifest_json ?? body.metadata;
        const bundleObj = typeof bundle === 'string'
            ? (() => { try { return JSON.parse(bundle); } catch { return null; } })()
            : bundle;
        if (!bundleObj || typeof bundleObj !== 'object') {
            return res.status(400).json(fail('bundle is required and must be a JSON object (or stringified JSON)'));
        }

        // Reject duplicate (package_id, version) up front for a clean error.
        const dup: any = await (driver as any).findOne?.('sys_package_version', {
            where: { package_id: pkg.id, version },
        });
        if (dup) {
            return res.status(409).json(fail(
                `Version '${version}' already exists for package '${pkg.manifest_id}'. Bump the version and retry.`,
            ));
        }

        const { json: manifestJson, checksum } = snapshotBundleAsManifest({
            manifestId: pkg.manifest_id,
            displayName: pkg.display_name,
            description: pkg.description,
            category: pkg.category,
            version,
            bundle: bundleObj,
        });

        const versionId = `pkgv_${randomUUID()}`;
        try {
            await (driver as any).create?.('sys_package_version', {
                id: versionId,
                created_at: nowIso(),
                updated_at: nowIso(),
                package_id: pkg.id,
                version,
                status: 'published',
                manifest_json: manifestJson,
                checksum,
                release_notes: typeof body.release_notes === 'string' ? body.release_notes : undefined,
                is_pre_release: body.is_pre_release === true || /-(alpha|beta|rc|dev|preview|staging|pr)/i.test(version),
                published_at: nowIso(),
                published_by: auth.mode === 'user' ? auth.userId : undefined,
                created_by: auth.mode === 'user' ? auth.userId : undefined,
            });
        } catch (err: any) {
            return res.status(500).json(fail(`Failed to create package version: ${err?.message ?? err}`));
        }

        // Optional auto-install into a target environment.
        const installEnvId = String(body.install_env_id ?? body.installEnvId ?? '').trim();
        let installResult: any = null;
        if (installEnvId) {
            const r = await installPackageIntoEnvironment({
                deps,
                packageId: pkg.id,
                environmentId: installEnvId,
                seedSampleData: body.seed_sample_data === true || body.seedSampleData === true,
                callerUserId: auth.mode === 'user' ? auth.userId : null,
                callerActiveOrgId: auth.mode === 'user' && getCallerActiveOrgId
                    ? (await getCallerActiveOrgId(req)) ?? null
                    : null,
            });
            installResult = r.body?.data ?? r.body;
        }

        return res.json(ok({
            id: versionId,
            package_id: pkg.id,
            manifest_id: pkg.manifest_id,
            version,
            checksum,
            installation: installResult,
        }));
    });
}
