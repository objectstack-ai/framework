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
 * Invoked by `createRuntimeStack()` whenever `OBJECTSTACK_CLOUD_URL`
 * (or `config.controlPlaneUrl`) is set. The same plugin shape is returned
 * as `createCloudStack()` so host configs can swap stacks transparently.
 */

import { Plugin, PluginContext } from '@objectstack/core';
import type { EnvironmentDriverRegistry } from './environment-registry.js';
import { KernelManager } from './kernel-manager.js';
import { ArtifactApiClient } from './artifact-api-client.js';
import { ArtifactEnvironmentRegistry } from './artifact-environment-registry.js';
import { ArtifactKernelFactory } from './artifact-kernel-factory.js';

export interface ObjectOSStackConfig {
    /** Control-plane base URL. Required. */
    controlPlaneUrl: string;
    /** Optional bearer token for the control-plane API. */
    controlPlaneApiKey?: string;
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
}

export interface ObjectOSStackResult {
    plugins: any[];
    api: { enableProjectScoping: true; projectResolution: 'auto' };
}

/**
 * Lazy-loaded host engine plugins. Mirrors the head of
 * `createControlPlanePlugins()` — ObjectQL + Driver + Metadata — but with
 * a transient in-memory driver instead of SQLite/Turso since the host
 * kernel never persists anything.
 */
async function createHostEnginePlugins(): Promise<Plugin[]> {
    const { ObjectQLPlugin } = await import('@objectstack/objectql');
    const { InMemoryDriver } = await import('@objectstack/driver-memory');
    const { DriverPlugin } = await import('@objectstack/runtime');
    const { MetadataPlugin } = await import('@objectstack/metadata');

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
        async stop(ctx: PluginContext) {
            const plugin = (this as any)._inner;
            if (plugin?.stop) await plugin.stop(ctx);
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
class ObjectOSProjectPlugin implements Plugin {
    readonly name = 'com.objectstack.runtime.objectos-project';
    readonly version = '1.0.0';

    private readonly config: ObjectOSStackConfig;
    private kernelManager?: KernelManager;
    private client?: ArtifactApiClient;

    constructor(config: ObjectOSStackConfig) {
        this.config = config;
    }

    init = async (ctx: PluginContext): Promise<void> => {
        this.client = new ArtifactApiClient({
            controlPlaneUrl: this.config.controlPlaneUrl,
            apiKey: this.config.controlPlaneApiKey,
            cacheTtlMs: this.config.artifactCacheTtlMs,
            logger: ctx.logger,
        });

        const envRegistry: EnvironmentDriverRegistry = new ArtifactEnvironmentRegistry({
            client: this.client,
            cacheTtlMs: this.config.envCacheTtlMs,
            logger: ctx.logger,
        });

        const factory = new ArtifactKernelFactory({
            client: this.client,
            envRegistry,
            logger: ctx.logger,
        });

        const kernelManager = new KernelManager({
            factory,
            maxSize: this.config.kernelCacheSize,
            ttlMs: this.config.kernelTtlMs,
            logger: ctx.logger,
        });
        this.kernelManager = kernelManager;

        ctx.registerService('env-registry', envRegistry);
        ctx.registerService('kernel-manager', kernelManager);
        ctx.registerService('artifact-api-client', this.client);

        ctx.logger.info?.('ObjectOSProjectPlugin: registered env-registry + kernel-manager', {
            controlPlaneUrl: this.config.controlPlaneUrl,
        });
    };

    destroy = async (): Promise<void> => {
        try { await this.kernelManager?.evictAll(); } catch { /* best effort */ }
        try { this.client?.clear(); } catch { /* best effort */ }
    };
}

export async function createObjectOSStack(config: ObjectOSStackConfig): Promise<ObjectOSStackResult> {
    if (!config.controlPlaneUrl) {
        throw new Error('[createObjectOSStack] controlPlaneUrl is required');
    }
    const merged: ObjectOSStackConfig = {
        ...config,
        kernelCacheSize: Number(process.env.OBJECTSTACK_KERNEL_CACHE_SIZE ?? config.kernelCacheSize ?? 32),
        kernelTtlMs: Number(process.env.OBJECTSTACK_KERNEL_TTL_MS ?? config.kernelTtlMs ?? 15 * 60 * 1000),
        envCacheTtlMs: Number(process.env.OBJECTSTACK_ENV_CACHE_TTL_MS ?? config.envCacheTtlMs ?? 5 * 60 * 1000),
        artifactCacheTtlMs: Number(process.env.OBJECTSTACK_ARTIFACT_CACHE_TTL_MS ?? config.artifactCacheTtlMs ?? 5 * 60 * 1000),
    };

    const enginePlugins = await createHostEnginePlugins();

    return {
        plugins: [...enginePlugins, new ObjectOSProjectPlugin(merged)],
        api: {
            enableProjectScoping: true,
            projectResolution: 'auto',
        },
    };
}
