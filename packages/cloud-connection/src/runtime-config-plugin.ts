// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * RuntimeConfigPlugin
 *
 * Serves `GET /api/v1/runtime/config` (and the legacy alias
 * `GET /api/v1/studio/runtime-config`) so the Console / Studio SPA can learn
 * the upstream cloud URL and capability flags **at boot time**, instead of
 * sniffing `window.location.hostname` or reading Vite-time env vars.
 *
 * Response shape:
 *
 *   {
 *     cloudUrl: string,            // base URL of the upstream cloud ('' = same origin)
 *     singleEnvironment: boolean,
 *     defaultOrgId?, defaultEnvironmentId?,   // multi-tenant, per-hostname
 *     features: { installLocal, marketplace, aiStudio, autoPublishAiBuilds },
 *     branding: { productName, productShortName }
 *   }
 *
 * ## Policy seam (ADR-0008 / open-mechanism-closed-intelligence)
 *
 * Which features a *plan* unlocks is distribution policy, not mechanism — it
 * intentionally does NOT live in this open package. Hosts inject it via
 * {@link RuntimeConfigPluginConfig.resolvePlanFeatures}: the cloud
 * distribution passes its plan-entitlement rules there; a self-hosted or
 * vanilla deployment omits it and gets static config-driven flags.
 */

import type { Plugin, PluginContext } from '@objectstack/core';
import { resolveCloudUrl } from './cloud-url.js';

/** Capability flags a host's plan policy can derive per request. */
export interface RuntimeConfigPlanFeatures {
    /** Whether the SPA should surface AI-driven metadata authoring. */
    aiStudio?: boolean;
    /** Whether AI-built apps auto-publish in the author's own environment. */
    autoPublishAiBuilds?: boolean;
}

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
     * AI-driven metadata authoring ("online development") affordances.
     * Default: true (the actual authoring capability is still gated
     * server-side; set false to force-hide the authoring UI).
     */
    aiStudio?: boolean;
    /**
     * Report this runtime as a single-environment deployment (CLI
     * `objectstack dev` / `os serve`). Defaults to `false` for
     * multi-tenant deployments.
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
    /**
     * Plan → feature policy hook. Called with `undefined` for the static
     * default (no environment resolved / no plan known) and with the
     * environment's plan string once hostname resolution provides one.
     * Returned flags override the static config defaults; omitted keys keep
     * them. When the hook itself is omitted, flags are purely config-driven.
     */
    resolvePlanFeatures?: (plan: string | undefined) => RuntimeConfigPlanFeatures;
}

export class RuntimeConfigPlugin implements Plugin {
    readonly name = 'com.objectstack.runtime.runtime-config';
    readonly version = '1.0.0';

    private readonly cloudUrl: string;
    private readonly installLocal: boolean;
    private readonly aiStudio: boolean;
    private readonly singleEnvironment: boolean;
    private readonly productName: string;
    private readonly productShortName: string;
    private readonly resolvePlanFeatures?: (plan: string | undefined) => RuntimeConfigPlanFeatures;

    constructor(config: RuntimeConfigPluginConfig = {}) {
        // An explicit empty string means "stay on this origin" — bypass the
        // resolver which would otherwise fall back to the default cloud URL.
        this.cloudUrl = config.controlPlaneUrl === ''
            ? ''
            : (resolveCloudUrl(config.controlPlaneUrl) ?? '');
        this.installLocal = !!config.installLocal;
        this.aiStudio = config.aiStudio !== false; // default true (override-to-hide)
        this.singleEnvironment = !!config.singleEnvironment;
        this.resolvePlanFeatures = config.resolvePlanFeatures;
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

            // A multi-tenant runtime serves many subdomains, each mapped to
            // one environment. Telling the SPA *which* environment it is
            // attached to (per-request) lets the App Marketplace skip the
            // env-picker dialog and install directly into "this" env — the
            // operator's domain already identifies it.
            //
            // Hostname → env is resolved by the same registry the per-env
            // kernel router uses (env-registry). Falls back to the static
            // payload when the host doesn't map to any env (e.g. a marketing
            // root or a CLI-served single-env runtime).
            let envRegistry: any = null;
            try { envRegistry = ctx.getService('env-registry'); } catch { /* not mounted (file/CLI mode) */ }

            const featuresFor = (plan: string | undefined, base: { aiStudio: boolean; autoPublishAiBuilds: boolean }) => {
                const derived = this.resolvePlanFeatures?.(plan);
                return {
                    aiStudio: derived?.aiStudio ?? base.aiStudio,
                    autoPublishAiBuilds: derived?.autoPublishAiBuilds ?? base.autoPublishAiBuilds,
                };
            };

            const handler = async (c: any) => {
                const rawHost = c.req.header('host') ?? '';
                const host = rawHost.split(':')[0].toLowerCase().trim();
                let defaultEnvironmentId: string | undefined;
                let defaultOrgId: string | undefined;
                let resolvedSingleEnv = this.singleEnvironment;
                // Static defaults: config-driven, optionally shaped by the
                // host's policy hook for the "no plan known" case.
                let features = featuresFor(undefined, { aiStudio: this.aiStudio, autoPublishAiBuilds: false });
                // EnvironmentDriverRegistry exposes `resolveByHostname()`;
                // older code paths used `resolveHostname()` on the client.
                // Accept either so production runtimes don't silently no-op
                // and leave the SPA showing the env picker.
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
                            // Plan-derived features — only an explicit
                            // non-empty plan re-runs the policy hook.
                            if (typeof resolved.plan === 'string' && resolved.plan.trim() !== '') {
                                features = featuresFor(resolved.plan, features);
                            }
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
                    features: {
                        installLocal: this.installLocal,
                        marketplace: true,
                        aiStudio: features.aiStudio,
                        autoPublishAiBuilds: features.autoPublishAiBuilds,
                    },
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
