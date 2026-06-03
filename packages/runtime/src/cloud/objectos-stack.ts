// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * createObjectOSStack
 *
 * ObjectOS pure-runtime stack — no control-plane database, no auth /
 * security / audit / tenant plugins. The host kernel registers:
 *
 *   - A minimal engine triplet (ObjectQL + in-memory DriverPlugin +
 *     MetadataPlugin) so CLI auto-injected plugins (Setup, Studio,
 *     Dispatcher, REST) and the runtime can boot. The host kernel itself
 *     never reads or writes business data — every record query is routed
 *     to a per-project kernel built from a remote artifact.
 *   - The `env-registry` and `kernel-manager` services, so the runtime's
 *     HTTP dispatcher can resolve hostnames and dispatch every request
 *     to the matching project kernel.
 *
 * Invoked by `createRuntimeStack()` whenever `OS_CLOUD_URL`
 * (or `config.controlPlaneUrl`) is set. The same plugin shape is returned
 * as `createCloudStack()` so host configs can swap stacks transparently.
 */

import { Plugin, PluginContext } from '@objectstack/core';
import type { EnvironmentDriverRegistry } from './environment-registry.js';
import { KernelManager } from './kernel-manager.js';
import { ArtifactApiClient } from './artifact-api-client.js';
import { ArtifactEnvironmentRegistry } from './artifact-environment-registry.js';
import { ArtifactKernelFactory } from './artifact-kernel-factory.js';
import { AuthProxyPlugin } from './auth-proxy-plugin.js';
import { MarketplaceProxyPlugin } from './marketplace-proxy-plugin.js';
import { RuntimeConfigPlugin } from './runtime-config-plugin.js';
import { FileArtifactApiClient, type FileArtifactApiClientConfig } from './file-artifact-api-client.js';

export interface ObjectOSStackConfig {
    /**
     * Control-plane base URL (HTTP) or a sentinel of `'file'` for the
     * local file-backed dev mode. Required unless `client` is supplied.
     *
     * - `http(s)://…`  — talk to a real ObjectStack Cloud control plane
     *   over HTTP and resolve hostnames via its `/cloud/*` API.
     * - `'file'`       — load a single project from a local
     *   `dist/objectstack.json` (or `fileConfig.artifactPath`). Every
     *   request, regardless of hostname, resolves to the same project.
     *   Intended for `pnpm dev` / smoke tests where standing up a
     *   separate control plane is overkill.
     */
    controlPlaneUrl?: string;
    /** Optional bearer token for the control-plane API. */
    controlPlaneApiKey?: string;
    /**
     * Override the artifact client entirely. When supplied,
     * `controlPlaneUrl` is ignored — useful for tests or custom transports.
     */
    client?: ArtifactApiClient | FileArtifactApiClient;
    /** Config for the file-backed mode (used when `controlPlaneUrl === 'file'`). */
    fileConfig?: FileArtifactApiClientConfig;
    /** KernelManager LRU size. Default: 32. */
    kernelCacheSize?: number;
    /** KernelManager idle TTL (ms). Default: 15 min. */
    kernelTtlMs?: number;
    /** EnvironmentDriverRegistry cache TTL (ms). Default: 5 min. */
    envCacheTtlMs?: number;
    /** Artifact / hostname response cache TTL (ms). Default: 5 min. */
    artifactCacheTtlMs?: number;
    /** API prefix (carried for parity with cloud-stack). Default: /api/v1. */
    apiPrefix?: string;
    /**
     * Host-supplied runtime plugins appended to the stack's default plugin
     * list. This is the official seam for a host (e.g. the ObjectStack Cloud
     * repo) to add **product/policy** plugins — marketplace install, cloud-
     * account binding, set-initial-password — to the otherwise-neutral
     * framework runtime, WITHOUT a framework release and without reaching into
     * the returned array by hand.
     *
     * They are appended last, so they mount their routes after the framework
     * plugins and can override/augment behaviour (e.g. supply a credentialled
     * install path that the browse-only MarketplaceProxyPlugin deliberately
     * does not). See docs/design/cloud-account-binding-marketplace-install.md
     * (ADR §5.2 — "framework exposes seams; cloud supplies metadata + policy").
     */
    extraPlugins?: Plugin[];
}

export interface ObjectOSStackResult {
    plugins: any[];
    api: { enableProjectScoping: true; projectResolution: 'auto'; requireAuth: true };
}

/**
 * Lazy-loaded host engine plugins. Mirrors the head of
 * `createControlPlanePlugins()` — ObjectQL + InMemory Driver + Metadata.
 *
 * The host kernel in objectos is a pure routing shell. Per-tenant auth +
 * business data live in per-project kernels (each backed by the project's
 * own Turso/Postgres DB), so there is nothing to persist on the host.
 *
 * AuthPlugin is intentionally NOT injected on the host (CLI's
 * `serve.ts` auto-injection guard skips it when `OS_CLOUD_URL` is set).
 * Identity is owned by `ArtifactKernelFactory` per project so that:
 *   - users persist in the project's DB across container cold-starts
 *   - cookies are scoped to the project's hostname (no `.<root>`-wide leak)
 *   - tokens are signed with a per-project HKDF-derived secret
 */
async function createHostEnginePlugins(): Promise<Plugin[]> {
    const { ObjectQLPlugin } = await import('@objectstack/objectql');
    const { DriverPlugin } = await import('../driver-plugin.js');
    const { MetadataPlugin } = await import('@objectstack/metadata');
    const { InMemoryDriver } = await import('@objectstack/driver-memory');

    const driver = new InMemoryDriver();
    const driverName = 'memory';

    const oqlRef: { ql: any } = { ql: null };
    const objectql: Plugin = {
        name: 'com.objectstack.engine.objectql',
        version: '0.0.0',
        async init(ctx: PluginContext) {
            const plugin = new ObjectQLPlugin();
            (this as any)._inner = plugin;
            if ((plugin as any).init) await (plugin as any).init(ctx);
            // Capture the engine instance AFTER init() — ObjectQLPlugin
            // creates its `ql` lazily inside init(), so reading `plugin.ql`
            // before that returns undefined and breaks the
            // datasource-mapping wiring below.
            oqlRef.ql = (plugin as any).ql ?? plugin;
        },
        async start(ctx: PluginContext) {
            const plugin = (this as any)._inner;
            // Forward start() so ObjectQLPlugin can discover `driver.*`
            // services (registered by DriverPlugin.init) and wire them
            // into the engine via `ql.registerDriver(...)`. Without this
            // the engine has zero drivers at request time, causing
            // `[ObjectQL] No driver available for object '...'` errors.
            if (plugin?.start) await plugin.start(ctx);
        },
        async destroy() {
            const plugin = (this as any)._inner;
            if (plugin?.destroy) await plugin.destroy();
            else if (plugin?.stop) await plugin.stop();
        },
    };

    const datasourceMapping: Plugin = {
        name: 'objectos-host-datasource-mapping',
        version: '0.0.0',
        dependencies: ['com.objectstack.engine.objectql'],
        async init() {
            const ql = oqlRef.ql;
            if (ql?.setDatasourceMapping) {
                ql.setDatasourceMapping([
                    { default: true, datasource: `com.objectstack.driver.${driverName}` },
                ]);
            }
        },
    };

    const driverPlugin = new DriverPlugin(driver as any, driverName);

    const metadata = new MetadataPlugin({
        watch: false,
        // The host kernel is a routing shell. It doesn't own metadata —
        // every per-project kernel registers its own.
        registerSystemObjects: false,
    });

    return [objectql, datasourceMapping, driverPlugin as unknown as Plugin, metadata as unknown as Plugin];
}

/**
 * Single host plugin that owns the artifact API client, the env registry,
 * and the kernel manager. Registered as services on the host kernel so
 * downstream plugins (the dispatcher, the REST API plugin) pick them up
 * automatically.
 */
class ObjectOSEnvironmentPlugin implements Plugin {
    readonly name = 'com.objectstack.runtime.objectos-environment';
    readonly version = '1.0.0';

    private readonly config: ObjectOSStackConfig;
    private kernelManager?: KernelManager;
    private client?: ArtifactApiClient;

    constructor(config: ObjectOSStackConfig) {
        this.config = config;
    }

    init = async (ctx: PluginContext): Promise<void> => {
        const client: ArtifactApiClient | FileArtifactApiClient = this.config.client
            ?? (this.config.controlPlaneUrl === 'file'
                ? new FileArtifactApiClient({
                    ...(this.config.fileConfig ?? {}),
                    logger: ctx.logger as any,
                })
                : new ArtifactApiClient({
                    controlPlaneUrl: this.config.controlPlaneUrl!,
                    apiKey: this.config.controlPlaneApiKey,
                    cacheTtlMs: this.config.artifactCacheTtlMs,
                    logger: ctx.logger,
                }));
        this.client = client as ArtifactApiClient;

        const envRegistry: EnvironmentDriverRegistry = new ArtifactEnvironmentRegistry({
            client: client as ArtifactApiClient,
            cacheTtlMs: this.config.envCacheTtlMs,
            logger: ctx.logger,
        });

        const factory = new ArtifactKernelFactory({
            client: client as ArtifactApiClient,
            envRegistry,
            logger: ctx.logger,
        });

        const kernelManager = new KernelManager({
            factory,
            maxSize: this.config.kernelCacheSize,
            ttlMs: this.config.kernelTtlMs,
            logger: ctx.logger,
            // Only the HTTP client exposes /freshness; file-mode (CLI dev)
            // has no upstream to probe.
            freshnessProbe: this.config.controlPlaneUrl === 'file'
                ? undefined
                : async (envId, builtAtMs) => {
                    const fresh = await (client as ArtifactApiClient).getFreshness(envId);
                    if (!fresh) return false; // unknown / unreachable → treat as fresh
                    const t = fresh.lastPublishedAt ? Date.parse(fresh.lastPublishedAt) : NaN;
                    if (!Number.isFinite(t)) return false;
                    if (t <= builtAtMs) return false;
                    // Upstream changed since this kernel was built. Drop
                    // the artifact cache too so the rebuild sees the new
                    // bundle (otherwise we'd happily rebuild from the
                    // same 5-minute-cached artifact JSON).
                    try { (client as ArtifactApiClient).invalidate(envId); } catch { /* best effort */ }
                    return true;
                },
        });
        this.kernelManager = kernelManager;

        ctx.registerService('env-registry', envRegistry);
        ctx.registerService('kernel-manager', kernelManager);
        ctx.registerService('artifact-api-client', client);

        ctx.logger.info?.('ObjectOSEnvironmentPlugin: registered env-registry + kernel-manager', {
            mode: this.config.controlPlaneUrl === 'file' ? 'file' : 'http',
            controlPlaneUrl: this.config.controlPlaneUrl,
        });
    };

    destroy = async (): Promise<void> => {
        try { await this.kernelManager?.evictAll(); } catch { /* best effort */ }
        try { this.client?.clear(); } catch { /* best effort */ }
    };
}

export async function createObjectOSStack(config: ObjectOSStackConfig): Promise<ObjectOSStackResult> {
    if (!config.controlPlaneUrl && !config.client) {
        throw new Error('[createObjectOSStack] either controlPlaneUrl or client is required');
    }
    const merged: ObjectOSStackConfig = {
        ...config,
        kernelCacheSize: Number(process.env.OS_KERNEL_CACHE_SIZE ?? config.kernelCacheSize ?? 32),
        kernelTtlMs: Number(process.env.OS_KERNEL_TTL_MS ?? config.kernelTtlMs ?? 15 * 60 * 1000),
        envCacheTtlMs: Number(process.env.OS_ENV_CACHE_TTL_MS ?? config.envCacheTtlMs ?? 5 * 60 * 1000),
        artifactCacheTtlMs: Number(process.env.OS_ARTIFACT_CACHE_TTL_MS ?? config.artifactCacheTtlMs ?? 5 * 60 * 1000),
    };

    const enginePlugins = await createHostEnginePlugins();

    return {
        plugins: [
            ...enginePlugins,
            new ObjectOSEnvironmentPlugin(merged),
            new AuthProxyPlugin(),
            new MarketplaceProxyPlugin({ controlPlaneUrl: merged.controlPlaneUrl === 'file' ? undefined : merged.controlPlaneUrl }),
            new RuntimeConfigPlugin({ controlPlaneUrl: merged.controlPlaneUrl === 'file' ? undefined : merged.controlPlaneUrl, installLocal: false }),
            // Host-supplied product/policy plugins (the official seam — see
            // ObjectOSStackConfig.extraPlugins). Appended last so they mount
            // after the framework defaults.
            ...(config.extraPlugins ?? []),
        ],
        api: {
            enableProjectScoping: true,
            projectResolution: 'auto',
            // ObjectOS is multi-tenant: anonymous /api/v1/data/* must never
            // leak per-project data across organisations. AuthProxyPlugin
            // verifies upstream tokens and populates ctx.userId; requireAuth
            // turns missing userId into 401 at the REST layer before the
            // request reaches the per-project kernel.
            requireAuth: true,
        },
    };
}
