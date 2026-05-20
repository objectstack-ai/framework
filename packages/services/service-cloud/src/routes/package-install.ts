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

export function registerPackageInstallRoutes(server: IHttpServer, deps: PackageInstallDeps): void {
    const { prefix, requiredKey, controlDriverPromise, getCallerUserId, getCallerActiveOrgId, templates = {} } = deps;
    const checkAuth = makeCheckAuth(requiredKey, getCallerUserId);
    const getDriver = makeGetDriver(controlDriverPromise);

    // ================================================================
    // POST /cloud/packages/:id/install
    // ================================================================
    server.post(`${prefix}/cloud/packages/:id/install`, async (req: any, res: any) => {
        const auth = await checkAuth(req);
        if (!auth.ok) return res.status(auth.status).json(auth.body);

        const packageId = String(req.params?.id ?? '').trim();
        if (!packageId) return res.status(400).json(fail('package id is required'));

        const body = (req.body ?? {}) as Record<string, any>;
        const environmentId = String(body.environment_id ?? body.environmentId ?? body.project_id ?? body.projectId ?? '').trim();
        if (!environmentId) return res.status(400).json(fail('environment_id is required'));

        // Optional opt-in: pre-populate the environment with sample data
        // from the package (e.g. demo Accounts/Contacts for the CRM starter).
        const seedSampleData = body.seed_sample_data === true
            || body.seed_sample_data === 'true'
            || body.seedSampleData === true
            || body.seedSampleData === 'true';

        const driver = await getDriver();
        if (!driver) return controlPlaneUnavailable(res);

        // 1. Load the sys_package row.
        const pkg: any = await (driver as any).findOne?.('sys_package', { where: { id: packageId } });
        if (!pkg) return res.status(404).json(fail(`Package ${packageId} not found`));

        // 2. Load the env (sys_project) row + verify org membership.
        const env: any = await (driver as any).findOne?.('sys_environment', { where: { id: environmentId } });
        if (!env) return res.status(404).json(fail(`Environment ${environmentId} not found`));

        if (auth.mode === 'user' && getCallerActiveOrgId) {
            const activeOrg = await getCallerActiveOrgId(req);
            if (activeOrg && env.organization_id && env.organization_id !== activeOrg) {
                return res.status(403).json(fail('Environment is not in your active organization'));
            }
            // Marketplace packages installable by any org; private packages only by the owning org.
            if (pkg.visibility !== 'marketplace' && pkg.owner_org_id && pkg.owner_org_id !== activeOrg) {
                return res.status(403).json(fail('You do not have access to this package'));
            }
        }

        // 3. Resolve (or lazy-snapshot) the latest sys_package_version.
        let version: any = await (driver as any).findOne?.('sys_package_version', {
            where: { package_id: packageId, status: 'published' },
            orderBy: [{ field: 'published_at', direction: 'desc' }],
        });
        if (!version) {
            // Lazy snapshot path — only works for starter templates whose
            // manifest_id maps back to the in-process template registry.
            const tplId = deriveTemplateIdFromManifest(pkg.manifest_id);
            const template = tplId ? templates[tplId] : undefined;
            if (!template) {
                return res.status(409).json(fail(
                    `No published version exists for package ${pkg.display_name ?? packageId} and no template snapshot is available`,
                ));
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
                    created_by: auth.mode === 'user' ? auth.userId : undefined,
                });
                version = await (driver as any).findOne?.('sys_package_version', { where: { id: versionId } });
            } catch (err: any) {
                console.error('[package-install] Snapshot failed:', err);
                return res.status(500).json(fail(`Failed to snapshot template: ${err?.message ?? err}`));
            }
        }

        // 4. UPSERT sys_package_installation (project_id + package_id unique).
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
                installed_by: auth.mode === 'user' ? auth.userId : undefined,
            });
        }

        // 5. Bump env's last_published_at so the next request triggers a
        //    kernel recycle and the multi-project-plugin re-reads installs.
        try {
            await (driver as any).update?.('sys_environment', environmentId, {
                last_published_at: nowIso(),
                updated_at: nowIso(),
            });
        } catch { /* non-fatal */ }

        return res.json(ok({
            installation_id: installationId,
            package_id: packageId,
            package_version_id: version.id,
            environment_id: environmentId,
            message: `Installed ${pkg.display_name ?? packageId} into environment ${env.name ?? environmentId}`,
        }));
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
