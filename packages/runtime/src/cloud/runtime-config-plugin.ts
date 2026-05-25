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
     * `OS_CLOUD_URL` / built-in default) when omitted.
     */
    controlPlaneUrl?: string;
    /** Override the `features.installLocal` flag. Default: false. */
    installLocal?: boolean;
}

export class RuntimeConfigPlugin implements Plugin {
    readonly name = 'com.objectstack.runtime.runtime-config';
    readonly version = '1.0.0';

    private readonly cloudUrl: string;
    private readonly installLocal: boolean;

    constructor(config: RuntimeConfigPluginConfig = {}) {
        this.cloudUrl = resolveCloudUrl(config.controlPlaneUrl) ?? '';
        this.installLocal = !!config.installLocal;
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
            const payload = {
                cloudUrl: this.cloudUrl,
                singleEnvironment: false,
                features: {
                    installLocal: this.installLocal,
                    marketplace: true,
                },
            };
            const handler = (c: any) => c.json(payload);
            rawApp.get('/api/v1/runtime/config', handler);
            // Legacy alias for older Studio bundles.
            rawApp.get('/api/v1/studio/runtime-config', handler);
            ctx.logger?.info?.('[RuntimeConfigPlugin] mounted /api/v1/runtime/config', {
                cloudUrl: this.cloudUrl || '(empty)',
                installLocal: this.installLocal,
            });
        });
    };

    destroy = async (): Promise<void> => {};
}
