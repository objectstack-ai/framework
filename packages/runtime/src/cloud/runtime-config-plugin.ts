// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * RuntimeConfigPlugin
 *
 * Serves `GET /api/v1/runtime/config` (and the legacy alias
 * `GET /api/v1/studio/runtime-config`) from a tenant ObjectOS runtime so
 * the Console / Studio SPA can learn the upstream cloud URL and capability
 * flags **at boot time**, instead of sniffing `window.location.hostname`
 * or reading Vite-time env vars.
 *
 * Response shape (mirrors cloud's `createStudioRuntimeConfigPlugin`):
 *
 *   {
 *     cloudUrl: string,            // base URL of the upstream cloud
 *     singleEnvironment: false,    // multi-tenant runtime
 *     features: {
 *       installLocal: boolean,     // false here — install-local is owned
 *                                  // by CLI `serve` (single-tenant), not
 *                                  // by createObjectOSStack
 *       marketplace: boolean,      // true — MarketplaceProxyPlugin mounts
 *                                  // /api/v1/marketplace/*
 *     }
 *   }
 *
 * Registers its routes on the Hono raw app, parallel to MarketplaceProxy /
 * AuthProxy / MarketplaceInstallLocal plugins.
 */

import type { Plugin, PluginContext } from '@objectstack/core';
import { resolveCloudUrl } from './cloud-url.js';

export interface RuntimeConfigPluginConfig {
    /**
     * Upstream cloud base URL. Falls back to `resolveCloudUrl()` (reads
     * `OS_CLOUD_URL` / built-in default) when omitted. Pass an explicit
     * empty string to declare "this runtime IS the cloud" (same-origin
     * for marketplace + install).
     */
    controlPlaneUrl?: string;
    /** Override the `features.installLocal` flag. Default: false. */
    installLocal?: boolean;
    /**
     * Override the `features.aiStudio` flag — whether the SPA should surface
     * AI-driven metadata authoring ("online development") affordances. Default:
     * true (the actual authoring capability is still gated server-side by the
     * presence of the `metadata_assistant` agent / @objectstack/service-ai-studio
     * package; set false to force-hide the authoring UI for a tier/deployment).
     */
    aiStudio?: boolean;
    /**
     * Report this runtime as a single-environment deployment (CLI
     * `objectstack dev` / `os serve`). Defaults to `false` for
     * multi-tenant ObjectOS.
     */
    singleEnvironment?: boolean;
    /**
     * Product name shown in browser title, splash screen, and other
     * client chrome. Operators can override per-deployment (white-label,
     * regional rebrands). Falls back to `OS_PRODUCT_NAME` env var, then
     * to the default `'ObjectOS'`.
     */
    productName?: string;
    /** Short product name (PWA shortName, compact spots). Defaults to productName. */
    productShortName?: string;
}

/**
 * @deprecated ADR-0006 — framework's DUPLICATE copy. Canonical implementation
 * lives in cloud `@objectstack/objectos-runtime`
 * (`packages/objectos-runtime/src/runtime-config-plugin.ts`), which
 * `apps/objectos` already uses. **Still load-bearing**: the framework CLI
 * `serve.ts` dynamically imports this for cloud-dev serve mode — DO NOT DELETE
 * until ADR-0006 Phase 4 decouples the CLI (= ADR-0007 ⑤). Phase 1 is a
 * declaration only: no behavior change.
 */
export class RuntimeConfigPlugin implements Plugin {
    readonly name = 'com.objectstack.runtime.runtime-config';
    readonly version = '1.0.0';

    private readonly cloudUrl: string;
    private readonly installLocal: boolean;
    private readonly aiStudio: boolean;
    private readonly singleEnvironment: boolean;
    private readonly productName: string;
    private readonly productShortName: string;

    constructor(config: RuntimeConfigPluginConfig = {}) {
        // An explicit empty string means "stay on this origin" — bypass the
        // resolver which would otherwise fall back to the default cloud URL.
        this.cloudUrl = config.controlPlaneUrl === ''
            ? ''
            : (resolveCloudUrl(config.controlPlaneUrl) ?? '');
        this.installLocal = !!config.installLocal;
        this.aiStudio = config.aiStudio !== false; // default true (override-to-hide)
        this.singleEnvironment = !!config.singleEnvironment;
        const envName = (typeof process !== 'undefined' ? process.env?.OS_PRODUCT_NAME : undefined)?.trim();
        const envShort = (typeof process !== 'undefined' ? process.env?.OS_PRODUCT_SHORT_NAME : undefined)?.trim();
        this.productName = (config.productName ?? envName ?? 'ObjectOS').trim() || 'ObjectOS';
        this.productShortName = (config.productShortName ?? envShort ?? this.productName).trim() || this.productName;
    }

    init = async (_ctx: PluginContext): Promise<void> => {};

    start = async (ctx: PluginContext): Promise<void> => {
        ctx.hook('kernel:ready', async () => {
            let httpServer: any;
            try {
                httpServer = ctx.getService('http-server');
            } catch {
                ctx.logger?.warn?.('[RuntimeConfigPlugin] http-server not available — runtime/config not mounted');
                return;
            }
            if (!httpServer || typeof httpServer.getRawApp !== 'function') {
                ctx.logger?.warn?.('[RuntimeConfigPlugin] http-server missing getRawApp() — runtime/config not mounted');
                return;
            }
            const rawApp = httpServer.getRawApp();

            // The tenant runtime is multi-tenant: one process serves many
            // subdomains, each mapped to one sys_environment row. Telling the
            // SPA *which* environment it is attached to (per-request) lets
            // the App Marketplace skip the env-picker dialog and install
            // directly into "this" env — the operator's domain already
            // identifies it.
            //
            // Hostname → env is resolved by the same registry the per-env
            // kernel router uses (env-registry). Falls back to the static
            // payload when the host doesn't map to any env (e.g. a
            // marketing root, a CLI-served single-env runtime, or
            // cloud.objectos.ai which mounts its own static handler).
            const features = {
                installLocal: this.installLocal,
                marketplace: true,
                aiStudio: this.aiStudio,
            };
            let envRegistry: any = null;
            try { envRegistry = ctx.getService('env-registry'); } catch { /* not mounted (file/CLI mode) */ }

            const handler = async (c: any) => {
                const rawHost = c.req.header('host') ?? '';
                const host = rawHost.split(':')[0].toLowerCase().trim();
                let defaultEnvironmentId: string | undefined;
                let defaultOrgId: string | undefined;
                let resolvedSingleEnv = this.singleEnvironment;
                // EnvironmentDriverRegistry exposes `resolveByHostname()`;
                // older code paths used `resolveHostname()` on the client.
                // Accept either so production runtimes (which register the
                // ArtifactEnvironmentRegistry implementing `resolveByHostname`)
                // don't silently no-op and leave the SPA showing the env
                // picker on per-subdomain pages.
                const resolveFn: ((h: string) => Promise<any>) | null =
                    typeof envRegistry?.resolveByHostname === 'function'
                        ? envRegistry.resolveByHostname.bind(envRegistry)
                        : typeof envRegistry?.resolveHostname === 'function'
                            ? envRegistry.resolveHostname.bind(envRegistry)
                            : null;
                if (resolveFn && host) {
                    try {
                        const resolved = await resolveFn(host);
                        if (resolved?.environmentId) {
                            defaultEnvironmentId = String(resolved.environmentId);
                            const orgId = resolved.organizationId ?? resolved.organization_id;
                            if (orgId) defaultOrgId = String(orgId);
                            // Each subdomain is one environment from the
                            // operator's POV: surface as single-environment
                            // so the SPA hides multi-env affordances.
                            resolvedSingleEnv = true;
                        }
                    } catch {
                        // Resolver failures are non-fatal — fall through
                        // to the static payload so /runtime/config never
                        // 500s. Worst case the SPA shows its env picker.
                    }
                }
                return c.json({
                    cloudUrl: this.cloudUrl,
                    singleEnvironment: resolvedSingleEnv,
                    defaultOrgId,
                    defaultEnvironmentId,
                    features,
                    branding: {
                        productName: this.productName,
                        productShortName: this.productShortName,
                    },
                });
            };
            rawApp.get('/api/v1/runtime/config', handler);
            // Legacy alias for older Studio bundles.
            rawApp.get('/api/v1/studio/runtime-config', handler);
            ctx.logger?.info?.('[RuntimeConfigPlugin] mounted /api/v1/runtime/config', {
                cloudUrl: this.cloudUrl || '(empty)',
                installLocal: this.installLocal,
                perHostEnvResolution: !!envRegistry,
            });
        });
    };

    destroy = async (): Promise<void> => {};
}
