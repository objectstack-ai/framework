// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MarketplaceProxyPlugin
 *
 * Forwards `GET /api/v1/marketplace/*` from a tenant ObjectOS runtime to
 * the configured ObjectStack Cloud control-plane URL. The cloud endpoint
 * (`packages/service-cloud/src/routes/marketplace.ts`) is unauthenticated
 * and only exposes packages whose owner has opted in to the public catalog
 * (`sys_package.marketplace_listed = true`) — so the proxy passes through
 * without any credentials.
 *
 * Why proxy instead of direct browser → cloud:
 *   - The Console SPA stays on the tenant origin, so no CORS configuration
 *     is required on the cloud side.
 *   - Local-dev `os serve` works regardless of whether the developer's
 *     browser has cookies for cloud.objectos.app.
 *   - Adds a single, easily auditable network seam between tenant and
 *     control plane.
 *
 * Install is NOT proxied here. Installing a package mutates control-plane
 * state and requires a cloud session + active organization context — the
 * Console SPA performs install by opening the cloud's install dialog in a
 * new tab so the user authenticates against cloud directly. A future
 * iteration may introduce a delegated install token; until then, browse
 * here and install on cloud.
 */

import type { Plugin, PluginContext } from '@objectstack/core';

const MARKETPLACE_PREFIX = '/api/v1/marketplace';

export interface MarketplaceProxyPluginConfig {
    /**
     * Control-plane base URL (e.g. https://cloud.objectos.app). When unset
     * the plugin mounts a stub that responds 503 — the SPA renders an
     * empty-state explaining marketplace is unavailable in this runtime.
     */
    controlPlaneUrl?: string;
}

export class MarketplaceProxyPlugin implements Plugin {
    readonly name = 'com.objectstack.runtime.marketplace-proxy';
    readonly version = '1.0.0';

    private readonly cloudUrl: string;

    constructor(config: MarketplaceProxyPluginConfig = {}) {
        this.cloudUrl = (config.controlPlaneUrl ?? '').replace(/\/+$/, '');
    }

    init = async (_ctx: PluginContext): Promise<void> => {
        // No services registered — pure HTTP wiring during start().
    };

    start = async (ctx: PluginContext): Promise<void> => {
        ctx.hook('kernel:ready', async () => {
            let httpServer: any;
            try {
                httpServer = ctx.getService('http-server');
            } catch {
                ctx.logger?.warn?.('[MarketplaceProxyPlugin] http-server not available — marketplace routes not mounted');
                return;
            }
            if (!httpServer || typeof httpServer.getRawApp !== 'function') {
                ctx.logger?.warn?.('[MarketplaceProxyPlugin] http-server missing getRawApp() — marketplace routes not mounted');
                return;
            }

            const rawApp = httpServer.getRawApp();
            const cloudUrl = this.cloudUrl;

            const handler = async (c: any, next: any) => {
                if (!cloudUrl) {
                    return c.json({
                        success: false,
                        error: {
                            code: 'marketplace_unavailable',
                            message: 'No control-plane URL configured for this runtime (OS_CLOUD_URL).',
                        },
                    }, 503);
                }
                try {
                    const incomingUrl = new URL(c.req.url);
                    // Do NOT proxy install-local — those are owned by
                    // MarketplaceInstallLocalPlugin and must hit this
                    // runtime, never cloud. Pass through so Hono can match
                    // the install-local route registered on the same app.
                    if (incomingUrl.pathname.startsWith(`${MARKETPLACE_PREFIX}/install-local`)) {
                        return next();
                    }
                    // Preserve the full /api/v1/marketplace/... path on cloud.
                    const target = `${cloudUrl}${incomingUrl.pathname}${incomingUrl.search}`;

                    // Forward only safe, idempotent methods. We intentionally
                    // do NOT proxy POST / PUT / DELETE here — those would
                    // need credentialled cloud auth which the tenant runtime
                    // does not carry.
                    const method = String(c.req.method ?? 'GET').toUpperCase();
                    if (method !== 'GET' && method !== 'HEAD') {
                        return c.json({
                            success: false,
                            error: {
                                code: 'marketplace_method_not_allowed',
                                message: `Marketplace proxy only forwards GET/HEAD; install via cloud.`,
                            },
                        }, 405);
                    }

                    const resp = await fetch(target, {
                        method,
                        headers: {
                            // Strip the inbound Host header — fetch will set
                            // it to the cloud host. Forward only the
                            // identifying headers cloud might log.
                            'Accept': c.req.header('accept') ?? 'application/json',
                            'User-Agent': `objectos-marketplace-proxy/${MarketplaceProxyPlugin.prototype.version ?? '1.0.0'}`,
                        },
                    });

                    const headers = new Headers();
                    const passthroughHeaders = ['content-type', 'cache-control', 'etag', 'last-modified'];
                    for (const h of passthroughHeaders) {
                        const v = resp.headers.get(h);
                        if (v) headers.set(h, v);
                    }

                    const body = await resp.arrayBuffer();
                    return new Response(body, { status: resp.status, headers });
                } catch (err: any) {
                    const errObj = err instanceof Error ? err : new Error(err?.message ?? String(err));
                    ctx.logger?.error?.('[MarketplaceProxyPlugin] proxy failed', errObj);
                    return c.json({
                        success: false,
                        error: {
                            code: 'marketplace_proxy_failed',
                            message: err?.message ?? String(err),
                        },
                    }, 502);
                }
            };

            if (typeof rawApp.all === 'function') {
                rawApp.all(`${MARKETPLACE_PREFIX}/*`, handler);
            } else {
                for (const m of ['get', 'head'] as const) {
                    try { rawApp[m]?.(`${MARKETPLACE_PREFIX}/*`, handler); } catch { /* best effort */ }
                }
            }

            ctx.logger?.info?.(`[MarketplaceProxyPlugin] mounted at ${MARKETPLACE_PREFIX}/* → ${cloudUrl || '(unconfigured)'}`);
        });
    };
}
