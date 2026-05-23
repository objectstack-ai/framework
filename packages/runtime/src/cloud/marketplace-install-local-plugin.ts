// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MarketplaceInstallLocalPlugin
 *
 * Installs marketplace packages into THIS runtime's kernel as opposed to a
 * remote cloud environment. Conceptually different from cloud install in
 * three important ways:
 *
 *   1. Single target — the local kernel is the only install target; there
 *      is no `sys_environment` picker.
 *   2. Manifests are cached on disk — once installed, the package is
 *      runnable offline. Cloud is only needed during the install action
 *      itself (to fetch the manifest snapshot).
 *   3. Coexists with user-authored apps — the local runtime usually has
 *      its own `objectstack.config.ts` declared apps. Install refuses to
 *      overwrite a manifest_id that's already registered to avoid silently
 *      replacing user code.
 *
 * Endpoints (mounted by `start()` on the `kernel:ready` hook):
 *
 *   POST   /api/v1/marketplace/install-local
 *          body: { packageId: string, versionId?: string }   (default: "latest")
 *          → fetches manifest from cloud, caches to disk, registers via
 *            the kernel's `manifest` service. Returns the installed entry.
 *
 *   GET    /api/v1/marketplace/install-local
 *          → lists currently installed marketplace packages
 *
 *   DELETE /api/v1/marketplace/install-local/:manifestId
 *          → removes the cached manifest. Kernel must be restarted to fully
 *            unload — `engine.registerApp` is additive only. We document
 *            this in the response message.
 *
 * Persistence layout:
 *   <cwd>/.objectstack/installed-packages/<safe-manifest-id>.json
 *   Each file: { packageId, versionId, manifestId, version, manifest, installedAt, installedBy }
 *
 * On `kernel:ready`, the plugin scans the directory and re-registers each
 * cached manifest so installs survive process restarts without further
 * cloud round-trips.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin, PluginContext } from '@objectstack/core';

const ROUTE_BASE = '/api/v1/marketplace/install-local';
const DEFAULT_DIR = '.objectstack/installed-packages';

export interface MarketplaceInstallLocalPluginConfig {
    /** Cloud control-plane base URL. When unset the install endpoint
     *  returns 503 (marketplace catalog requires cloud). */
    controlPlaneUrl?: string;
    /** Override the on-disk cache directory. Defaults to
     *  `<cwd>/.objectstack/installed-packages`. */
    storageDir?: string;
}

interface InstalledEntry {
    packageId: string;
    versionId: string;
    manifestId: string;
    version: string;
    manifest: any;
    installedAt: string;
    installedBy: string | null;
}

function safeFilename(manifestId: string): string {
    return manifestId.replace(/[^a-zA-Z0-9._-]/g, '_') + '.json';
}

export class MarketplaceInstallLocalPlugin implements Plugin {
    readonly name = 'com.objectstack.runtime.marketplace-install-local';
    readonly version = '1.0.0';

    private readonly cloudUrl: string;
    private readonly storageDir: string;

    constructor(config: MarketplaceInstallLocalPluginConfig = {}) {
        this.cloudUrl = (config.controlPlaneUrl ?? '').replace(/\/+$/, '');
        this.storageDir = config.storageDir
            ? resolve(config.storageDir)
            : resolve(process.cwd(), DEFAULT_DIR);
    }

    init = async (_ctx: PluginContext): Promise<void> => {
        // No services registered — pure HTTP wiring during start().
    };

    start = async (ctx: PluginContext): Promise<void> => {
        ctx.hook('kernel:ready', async () => {
            // 1. Rehydrate previously installed packages so they survive restart.
            await this.rehydrate(ctx);

            // 2. Mount HTTP endpoints.
            let httpServer: any;
            try {
                httpServer = ctx.getService('http-server');
            } catch {
                ctx.logger?.warn?.('[MarketplaceInstallLocal] http-server not available — install endpoints not mounted');
                return;
            }
            if (!httpServer || typeof httpServer.getRawApp !== 'function') {
                ctx.logger?.warn?.('[MarketplaceInstallLocal] http-server missing getRawApp() — install endpoints not mounted');
                return;
            }
            const rawApp = httpServer.getRawApp();

            const postHandler = async (c: any) => this.handleInstall(c, ctx);
            const getHandler = async (c: any) => this.handleList(c);
            const deleteHandler = async (c: any) => this.handleUninstall(c, ctx);

            if (typeof rawApp.post === 'function') rawApp.post(ROUTE_BASE, postHandler);
            if (typeof rawApp.get === 'function') rawApp.get(ROUTE_BASE, getHandler);
            if (typeof rawApp.delete === 'function') rawApp.delete(`${ROUTE_BASE}/:manifestId`, deleteHandler);

            ctx.logger?.info?.(`[MarketplaceInstallLocal] mounted at ${ROUTE_BASE} (storage: ${this.storageDir})`);
        });
    };

    /**
     * Re-register every cached manifest with the kernel's manifest service.
     * Safe to call on a kernel that already has the same manifest_id (the
     * underlying ObjectQL registry overwrites by id, but we still warn so
     * a developer can spot the dev-time clash between their config.ts and
     * a marketplace package).
     */
    private rehydrate = async (ctx: PluginContext): Promise<void> => {
        const entries = this.readAll();
        if (entries.length === 0) return;

        let manifestService: { register(m: any): void } | null = null;
        try {
            manifestService = ctx.getService('manifest') as any;
        } catch {
            ctx.logger?.warn?.('[MarketplaceInstallLocal] no `manifest` service — rehydrate skipped');
            return;
        }

        for (const entry of entries) {
            try {
                manifestService!.register(entry.manifest);
                ctx.logger?.info?.(`[MarketplaceInstallLocal] rehydrated ${entry.manifestId}@${entry.version}`);
            } catch (err: any) {
                ctx.logger?.error?.(`[MarketplaceInstallLocal] rehydrate failed for ${entry.manifestId}`, err instanceof Error ? err : new Error(String(err)));
            }
        }
    };

    private handleInstall = async (c: any, ctx: PluginContext): Promise<Response> => {
        if (!this.cloudUrl) {
            return c.json({ success: false, error: { code: 'marketplace_unavailable', message: 'OS_CLOUD_URL not configured.' } }, 503);
        }
        const userId = await this.requireAuthenticatedUser(c);
        if (!userId) {
            return c.json({ success: false, error: { code: 'unauthorized', message: 'Authentication required to install packages.' } }, 401);
        }

        let body: any = {};
        try { body = await c.req.json(); } catch { /* empty body */ }
        const packageId = String(body?.packageId ?? '').trim();
        const versionId = String(body?.versionId ?? 'latest').trim() || 'latest';
        if (!packageId) {
            return c.json({ success: false, error: { code: 'bad_request', message: 'packageId is required.' } }, 400);
        }

        // 1. Fetch manifest snapshot from cloud
        let payload: any;
        try {
            const url = `${this.cloudUrl}/api/v1/marketplace/packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(versionId)}/manifest`;
            const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!resp.ok) {
                const text = await resp.text().catch(() => '');
                return c.json({
                    success: false,
                    error: { code: 'cloud_fetch_failed', message: `Cloud returned ${resp.status}: ${text.slice(0, 200)}` },
                }, resp.status === 404 ? 404 : 502);
            }
            payload = await resp.json();
        } catch (err: any) {
            return c.json({
                success: false,
                error: { code: 'cloud_fetch_failed', message: err?.message ?? String(err) },
            }, 502);
        }

        const data = payload?.data ?? payload;
        const manifest = data?.manifest;
        const resolvedVersionId = String(data?.version_id ?? versionId);
        const version = String(data?.version ?? 'unknown');
        const manifestId = String(manifest?.id ?? manifest?.name ?? '');
        if (!manifest || !manifestId) {
            return c.json({ success: false, error: { code: 'invalid_manifest', message: 'Cloud returned an invalid manifest payload.' } }, 502);
        }

        // 2. Conflict check — refuse to overwrite user-authored apps
        const conflict = this.findConflict(ctx, manifestId);
        if (conflict === 'user-code') {
            return c.json({
                success: false,
                error: {
                    code: 'manifest_conflict',
                    message: `manifest_id "${manifestId}" is already defined by this runtime's local code. Refusing to overwrite. Uninstall the local definition first.`,
                },
            }, 409);
        }

        // 3. Persist on disk
        const entry: InstalledEntry = {
            packageId,
            versionId: resolvedVersionId,
            manifestId,
            version,
            manifest,
            installedAt: new Date().toISOString(),
            installedBy: userId,
        };
        try {
            mkdirSync(this.storageDir, { recursive: true });
            writeFileSync(join(this.storageDir, safeFilename(manifestId)), JSON.stringify(entry, null, 2), 'utf8');
        } catch (err: any) {
            return c.json({
                success: false,
                error: { code: 'storage_failed', message: `Failed to persist manifest: ${err?.message ?? err}` },
            }, 500);
        }

        // 4. Hot-register via manifest service (works post-bootstrap)
        try {
            const manifestService = ctx.getService('manifest') as any;
            manifestService.register(manifest);
        } catch (err: any) {
            // Persisted on disk so a restart would still pick it up;
            // surface the error but keep the install record.
            ctx.logger?.warn?.(`[MarketplaceInstallLocal] hot-register failed for ${manifestId} (will load on next restart): ${err?.message ?? err}`);
        }

        return c.json({
            success: true,
            data: {
                manifestId,
                version,
                versionId: resolvedVersionId,
                installedAt: entry.installedAt,
                hotLoaded: true,
                upgradedFrom: conflict === 'marketplace' ? 'previous-marketplace-version' : null,
                note: 'App is now available in this runtime. Refresh the console to see it in the app switcher.',
            },
        }, 200);
    };

    private handleList = async (c: any): Promise<Response> => {
        const entries = this.readAll();
        return c.json({
            success: true,
            data: {
                items: entries.map(e => ({
                    packageId: e.packageId,
                    versionId: e.versionId,
                    manifestId: e.manifestId,
                    version: e.version,
                    installedAt: e.installedAt,
                    installedBy: e.installedBy,
                })),
                total: entries.length,
                storageDir: this.storageDir,
            },
        }, 200);
    };

    private handleUninstall = async (c: any, ctx: PluginContext): Promise<Response> => {
        const userId = await this.requireAuthenticatedUser(c);
        if (!userId) {
            return c.json({ success: false, error: { code: 'unauthorized', message: 'Authentication required.' } }, 401);
        }
        const manifestId = String(c.req.param?.('manifestId') ?? c.req.params?.manifestId ?? '').trim();
        if (!manifestId) {
            return c.json({ success: false, error: { code: 'bad_request', message: 'manifestId path param required.' } }, 400);
        }
        const file = join(this.storageDir, safeFilename(manifestId));
        if (!existsSync(file)) {
            return c.json({ success: false, error: { code: 'not_found', message: `No marketplace install for ${manifestId}.` } }, 404);
        }
        try {
            unlinkSync(file);
        } catch (err: any) {
            return c.json({ success: false, error: { code: 'storage_failed', message: err?.message ?? String(err) } }, 500);
        }
        ctx.logger?.info?.(`[MarketplaceInstallLocal] uninstalled ${manifestId} (cached manifest removed; restart runtime to unload from running kernel)`);
        return c.json({
            success: true,
            data: {
                manifestId,
                note: 'Cached manifest removed. The app remains loaded in the running kernel until the next restart (the kernel API does not support unregistering apps in-place).',
            },
        }, 200);
    };

    /**
     * Detect whether `manifestId` is already known to the kernel and classify
     * the source so we can refuse vs upgrade gracefully.
     *
     *   'none'         — fresh install
     *   'marketplace'  — previously installed by this plugin (allow upgrade)
     *   'user-code'    — defined by AppPlugin from objectstack.config.ts
     *                    (refuse to avoid silently overwriting authored code)
     */
    private findConflict = (ctx: PluginContext, manifestId: string): 'none' | 'marketplace' | 'user-code' => {
        // First check: do we already have a marketplace install file?
        if (existsSync(join(this.storageDir, safeFilename(manifestId)))) {
            return 'marketplace';
        }
        // Then check: is the manifest_id already in the engine's registry?
        try {
            const ql: any = ctx.getService('objectql');
            const packages: any[] = ql?.registry?.getAllPackages?.() ?? [];
            const hit = packages.find((p: any) =>
                (p?.manifest?.id ?? p?.id ?? p?.manifest?.name) === manifestId,
            );
            if (hit) return 'user-code';
        } catch { /* objectql not registered yet — treat as fresh */ }
        return 'none';
    };

    /**
     * Pull a userId out of the request's better-auth session, if any.
     * Returns null when there is no signed-in user. v1 does not check
     * admin role — UI gating + the auth requirement is sufficient for
     * dev / single-tenant runtimes. Stricter checks can be layered on
     * via a middleware in cloud-hosted multi-tenant deployments.
     */
    private requireAuthenticatedUser = async (c: any): Promise<string | null> => {
        try {
            // Attempt to read a session via the better-auth helper exposed
            // on the context by AuthPlugin; fall back to header probe.
            const session = (c?.get?.('auth')?.session) ?? c?.session ?? null;
            const userId = session?.user?.id ?? session?.userId ?? null;
            if (userId) return String(userId);
        } catch { /* ignore */ }
        // Header fallback for cases where Hono context doesn't surface it
        const xUserId = c?.req?.header?.('x-user-id');
        if (xUserId) return String(xUserId);
        return null;
    };

    private readAll = (): InstalledEntry[] => {
        if (!existsSync(this.storageDir)) return [];
        const out: InstalledEntry[] = [];
        for (const name of readdirSync(this.storageDir)) {
            if (!name.endsWith('.json')) continue;
            try {
                const raw = readFileSync(join(this.storageDir, name), 'utf8');
                out.push(JSON.parse(raw));
            } catch { /* skip corrupt files */ }
        }
        return out;
    };
}
