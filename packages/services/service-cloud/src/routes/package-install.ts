// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Package install routes — Marketplace install loop.
 *
 *   POST /cloud/packages/:id/install
 *     body: { environment_id: string }
 *     Effect:
 *       1. Verify sys_package exists and caller can install it
 *          (visibility=marketplace OR owner_org_id=caller's active org)
 *       2. Verify environment (sys_project row) belongs to caller's active org
 *       3. Lazy-snapshot the manifest into sys_package_version (if absent)
 *          — only for `is_starter` packages backed by a template registry
 *       4. UPSERT sys_package_installation row (project_id + package_id unique)
 *       5. Bump sys_project.last_published_at to nudge the env kernel to recycle
 *
 *   POST /cloud/installations/:id/uninstall
 *     Soft-disable the install row (enabled=false). Env kernel will skip on
 *     next boot. We intentionally do NOT drop tables — that's destructive
 *     and irreversible; a future "purge" action can do that explicitly.
 */

import { randomUUID } from 'node:crypto';
import type { IHttpServer } from '@objectstack/spec/contracts';
import { fail, ok, KNOWN_METADATA_CATEGORIES } from '../cloud-artifact-helpers.js';
import type { RouteDeps } from './types.js';
import { makeCheckAuth, makeGetDriver, controlPlaneUnavailable } from './types.js';
import type { ProjectTemplate } from '../multi-project-plugin.js';
import { starterManifestId } from '../starter-seeder-plugin.js';

const STARTER_MANIFEST_PREFIX = 'app.objectstack.starter.';

function nowIso(): string {
    return new Date().toISOString();
}

function deriveTemplateIdFromManifest(manifestId: string): string | null {
    if (!manifestId?.startsWith(STARTER_MANIFEST_PREFIX)) return null;
    return manifestId.slice(STARTER_MANIFEST_PREFIX.length);
}

/**
 * Extract a portable manifest snapshot from a template bundle. The shape
 * mirrors what `kernel.objectql.registry.getAllPackages()` returns so the
 * multi-project-plugin can materialize it directly without normalization.
 */
function snapshotManifest(template: ProjectTemplate, bundle: any): string {
    const safe: Record<string, any> = {
        id: starterManifestId(template.id),
        name: template.label,
        description: template.description,
        category: template.category ?? 'starter',
        version: '1.0.0',
    };
    // Copy every known metadata category from the template bundle so the
    // snapshot is a complete portable manifest (objects, views, apps,
    // dashboards, flows, agents, tools, data, reports, hooks, actions,
    // permissions, roles, sharingRules, i18n, etc.).
    for (const key of KNOWN_METADATA_CATEGORIES) {
        const val = (bundle as any)?.[key];
        if (Array.isArray(val) && val.length > 0) {
            safe[key] = val;
        }
    }
    // Translations may live under either `translations` or `i18n`.
    if (!safe.translations && (bundle as any)?.i18n) {
        safe.translations = (bundle as any).i18n;
    }
    return JSON.stringify(safe);
}

export interface PackageInstallDeps extends RouteDeps {
    templates?: Record<string, ProjectTemplate>;
}

/**
 * Result envelope from {@link installPackageIntoEnvironment}. Mirrors the
 * shape we'd return over HTTP so callers (route handlers, server-action
 * dispatchers) can forward verbatim.
 */
export interface InstallPackageResult {
    status: number;
    body: { success: boolean; data?: any; error?: string };
}

/**
 * Transport-agnostic install helper — used by both:
 *   • POST /cloud/packages/:id/install        (marketplace flow)
 *   • POST /cloud/environments/:id/install-package (env-detail flow)
 *   • POST /api/v1/actions/sys_environment/install_application
 *           (app-shell RecordDetailView script dispatcher — needed because
 *            its built-in apiHandler ignores action.target and falls back
 *            to dataSource.update, see RecordDetailView.js apiHandler).
 *
 * Behavior is identical to the original inline route: verify caller can
 * install the package into the target env, lazy-snapshot starter manifests
 * into sys_package_version, UPSERT sys_package_installation, bump
 * last_published_at so the env kernel recycles on next request.
 */
export async function installPackageIntoEnvironment(args: {
    deps: PackageInstallDeps;
    packageId: string;
    environmentId: string;
    seedSampleData: boolean;
    callerUserId?: string | null;
    callerActiveOrgId?: string | null;
}): Promise<InstallPackageResult> {
    const { deps, packageId, environmentId, seedSampleData, callerUserId, callerActiveOrgId } = args;
    const { controlDriverPromise, templates = {} } = deps;
    if (!packageId) return { status: 400, body: fail('package id is required') };
    if (!environmentId) return { status: 400, body: fail('environment_id is required') };

    const driverEnvelope = await controlDriverPromise;
    const driver = driverEnvelope?.driver;
    if (!driver) return { status: 503, body: fail('Control-plane driver is unavailable') };

    const pkg: any = await (driver as any).findOne?.('sys_package', { where: { id: packageId } });
    if (!pkg) return { status: 404, body: fail(`Package ${packageId} not found`) };

    const env: any = await (driver as any).findOne?.('sys_environment', { where: { id: environmentId } });
    if (!env) return { status: 404, body: fail(`Environment ${environmentId} not found`) };

    if (callerActiveOrgId) {
        if (env.organization_id && env.organization_id !== callerActiveOrgId) {
            return { status: 403, body: fail('Environment is not in your active organization') };
        }
        if (pkg.visibility !== 'marketplace' && pkg.owner_org_id && pkg.owner_org_id !== callerActiveOrgId) {
            return { status: 403, body: fail('You do not have access to this package') };
        }
    }

    let version: any = await (driver as any).findOne?.('sys_package_version', {
        where: { package_id: packageId, status: 'published' },
        orderBy: [{ field: 'published_at', direction: 'desc' }],
    });
    if (!version) {
        const tplId = deriveTemplateIdFromManifest(pkg.manifest_id);
        const template = tplId ? templates[tplId] : undefined;
        if (!template) {
            return { status: 409, body: fail(
                `No published version exists for package ${pkg.display_name ?? packageId} and no template snapshot is available`,
            ) };
        }
        try {
            const bundle = await template.load();
            const manifestJson = snapshotManifest(template, bundle);
            const versionId = `pkgv_${randomUUID()}`;
            await (driver as any).create?.('sys_package_version', {
                id: versionId,
                created_at: nowIso(),
                updated_at: nowIso(),
                package_id: packageId,
                version: '1.0.0',
                status: 'published',
                manifest_json: manifestJson,
                is_pre_release: false,
                published_at: nowIso(),
                created_by: callerUserId ?? undefined,
            });
            version = await (driver as any).findOne?.('sys_package_version', { where: { id: versionId } });
        } catch (err: any) {
            console.error('[package-install] Snapshot failed:', err);
            return { status: 500, body: fail(`Failed to snapshot template: ${err?.message ?? err}`) };
        }
    }

    const existing: any = await (driver as any).findOne?.('sys_package_installation', {
        where: { environment_id: environmentId, package_id: packageId },
    });
    let installationId: string;
    if (existing && existing.id) {
        installationId = existing.id;
        await (driver as any).update?.('sys_package_installation', existing.id, {
            updated_at: nowIso(),
            package_version_id: version.id,
            status: 'installed',
            enabled: true,
            with_sample_data: seedSampleData,
        });
    } else {
        installationId = `pkgi_${randomUUID()}`;
        await (driver as any).create?.('sys_package_installation', {
            id: installationId,
            created_at: nowIso(),
            updated_at: nowIso(),
            environment_id: environmentId,
            package_id: packageId,
            package_version_id: version.id,
            status: 'installed',
            enabled: true,
            with_sample_data: seedSampleData,
            installed_at: nowIso(),
            installed_by: callerUserId ?? undefined,
        });
    }

    try {
        await (driver as any).update?.('sys_environment', environmentId, {
            last_published_at: nowIso(),
            updated_at: nowIso(),
        });
    } catch { /* non-fatal */ }

    return { status: 200, body: ok({
        installation_id: installationId,
        package_id: packageId,
        package_version_id: version.id,
        environment_id: environmentId,
        message: `Installed ${pkg.display_name ?? packageId} into environment ${env.name ?? environmentId}`,
    }) };
}

export function registerPackageInstallRoutes(server: IHttpServer, deps: PackageInstallDeps): void {
    const { prefix, requiredKey, controlDriverPromise, getCallerUserId, getCallerActiveOrgId } = deps;
    const checkAuth = makeCheckAuth(requiredKey, getCallerUserId);
    const getDriver = makeGetDriver(controlDriverPromise);

    // Shared install handler — invoked by both:
    //   POST /cloud/packages/:id/install        (package-keyed, body.environment_id)
    //   POST /cloud/environments/:id/install-package (env-keyed, body.package_id)
    async function runInstall(req: any, res: any, packageId: string, environmentId: string) {
        const auth = await checkAuth(req);
        if (!auth.ok) return res.status(auth.status).json(auth.body);

        const body = (req.body ?? {}) as Record<string, any>;
        const seedSampleData = body.seed_sample_data === true
            || body.seed_sample_data === 'true'
            || body.seedSampleData === true
            || body.seedSampleData === 'true';

        const driver = await getDriver();
        if (!driver) return controlPlaneUnavailable(res);

        const callerActiveOrg = (auth.mode === 'user' && getCallerActiveOrgId)
            ? await getCallerActiveOrgId(req)
            : null;

        const result = await installPackageIntoEnvironment({
            deps,
            packageId,
            environmentId,
            seedSampleData,
            callerUserId: auth.mode === 'user' ? auth.userId : null,
            callerActiveOrgId: callerActiveOrg ?? null,
        });
        return res.status(result.status).json(result.body);
    }

    // ================================================================
    // POST /cloud/packages/:id/install
    //   (marketplace-keyed install — Install dialog on sys_package row)
    // ================================================================
    server.post(`${prefix}/cloud/packages/:id/install`, async (req: any, res: any) => {
        const packageId = String(req.params?.id ?? '').trim();
        const body = (req.body ?? {}) as Record<string, any>;
        const environmentId = String(
            body.environment_id ?? body.environmentId ?? body.project_id ?? body.projectId ?? '',
        ).trim();
        return runInstall(req, res, packageId, environmentId);
    });

    // ================================================================
    // POST /cloud/environments/:id/install-package
    //   (env-keyed install — Install Application CTA on sys_environment row)
    // ================================================================
    server.post(`${prefix}/cloud/environments/:id/install-package`, async (req: any, res: any) => {
        const environmentId = String(req.params?.id ?? '').trim();
        const body = (req.body ?? {}) as Record<string, any>;
        const packageId = String(body.package_id ?? body.packageId ?? '').trim();
        return runInstall(req, res, packageId, environmentId);
    });

    // ================================================================
    // POST /cloud/installations/:id/uninstall  (soft-disable)
    // ================================================================
    server.post(`${prefix}/cloud/installations/:id/uninstall`, async (req: any, res: any) => {
        const auth = await checkAuth(req);
        if (!auth.ok) return res.status(auth.status).json(auth.body);

        const installationId = String(req.params?.id ?? '').trim();
        if (!installationId) return res.status(400).json(fail('installation id is required'));

        const driver = await getDriver();
        if (!driver) return controlPlaneUnavailable(res);

        const install: any = await (driver as any).findOne?.('sys_package_installation', { where: { id: installationId } });
        if (!install) return res.status(404).json(fail(`Installation ${installationId} not found`));

        if (auth.mode === 'user' && getCallerActiveOrgId) {
            const env: any = await (driver as any).findOne?.('sys_environment', { where: { id: install.environment_id } });
            const activeOrg = await getCallerActiveOrgId(req);
            if (env?.organization_id && activeOrg && env.organization_id !== activeOrg) {
                return res.status(403).json(fail('Installation belongs to another organization'));
            }
        }

        await (driver as any).update?.('sys_package_installation', installationId, {
            updated_at: nowIso(),
            status: 'disabled',
            enabled: false,
        });

        try {
            await (driver as any).update?.('sys_environment', install.environment_id, {
                last_published_at: nowIso(),
                updated_at: nowIso(),
            });
        } catch { /* non-fatal */ }

        return res.json(ok({
            installation_id: installationId,
            message: 'Package uninstalled (soft-disable). Tables preserved.',
        }));
    });
}
