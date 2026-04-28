// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * SharedProjectPlugin
 *
 * Registers `driver`, `metadata`, and `objectql` as SCOPED services on a
 * shared kernel. Each unique `scopeId` (projectId) gets its own isolated
 * instances of these three services, while all other plugin code (HTTP
 * handlers, auth, realtime, etc.) is shared across all projects.
 *
 * Memory profile vs per-kernel mode:
 *   Before: 32 projects × ~30 MB = ~960 MB
 *   After:  ~50 MB kernel + 32 × ~5 MB scoped context = ~210 MB
 *
 * Usage:
 *   const sharedKernel = new ObjectKernel();
 *   sharedKernel.use(new SharedProjectPlugin({ envRegistry, basePlugins }));
 *   await sharedKernel.bootstrap();
 *   // Per-request: const ql = await ctx.getServiceScoped('objectql', projectId);
 */

import { Plugin, PluginContext } from '@objectstack/core';
import { ServiceLifecycle } from '@objectstack/core';
import type { EnvironmentDriverRegistry } from './environment-registry.js';
import { ProjectScopeManager } from './project-scope-manager.js';

export interface SharedProjectPluginConfig {
    /** Registry used to resolve per-project drivers by projectId. */
    envRegistry: EnvironmentDriverRegistry;
    /** Optional TTL config for the scope manager. Defaults: ttlMs=15min, maxSize=200. */
    scopeTtlMs?: number;
    scopeMaxSize?: number;
}

export class SharedProjectPlugin implements Plugin {
    readonly name = 'com.objectstack.runtime.shared-project';
    readonly version = '1.0.0';

    private readonly config: SharedProjectPluginConfig;

    constructor(config: SharedProjectPluginConfig) {
        this.config = config;
    }

    init = async (ctx: PluginContext): Promise<void> => {
        const { envRegistry } = this.config;

        // Register the env-registry so other services can access it
        ctx.registerService('env-registry', envRegistry);

        // SCOPED: per-project driver — resolved from EnvironmentDriverRegistry
        ctx.registerServiceFactory(
            'driver',
            async (_ctx, scopeId) => {
                if (!scopeId) {
                    throw new Error('[SharedProjectPlugin] scopeId (projectId) required for scoped driver');
                }
                const driver = await envRegistry.resolveById(scopeId);
                if (!driver) {
                    throw new Error(`[SharedProjectPlugin] No driver found for project: ${scopeId}`);
                }
                return driver;
            },
            ServiceLifecycle.SCOPED,
        );

        // SCOPED: per-project MetadataManager — each project gets a fresh instance
        // backed by its own driver, loaded lazily on first metadata access.
        ctx.registerServiceFactory(
            'metadata',
            async (_ctx, scopeId) => {
                if (!scopeId) {
                    throw new Error('[SharedProjectPlugin] scopeId (projectId) required for scoped metadata');
                }
                // Dynamic import — @objectstack/metadata is a peer dep, not a hard dep of runtime.
                // new Function prevents bundlers (Vite/Rolldown) from resolving this as a bare specifier.
                const metadataMod = await new Function('m', 'return import(m)')('@objectstack/metadata');
                const MetadataManager = metadataMod.MetadataManager;
                const driver = await _ctx.getServiceScoped<any>('driver', scopeId);
                const manager = new MetadataManager();
                (manager as any)._projectId = scopeId;
                (manager as any)._driver = driver;
                return manager;
            },
            ServiceLifecycle.SCOPED,
        );

        // SCOPED: per-project ObjectQL engine
        ctx.registerServiceFactory(
            'objectql',
            async (_ctx, scopeId) => {
                if (!scopeId) {
                    throw new Error('[SharedProjectPlugin] scopeId (projectId) required for scoped objectql');
                }
                // Dynamic import — @objectstack/objectql is a peer dep, not a hard dep of runtime.
                // new Function prevents bundlers (Vite/Rolldown) from resolving this as a bare specifier.
                const objectqlMod = await new Function('m', 'return import(m)')('@objectstack/objectql');
                const ObjectQL = objectqlMod.ObjectQL;
                const driver = await _ctx.getServiceScoped<any>('driver', scopeId);
                const ql = new ObjectQL({ logger: _ctx.logger });
                ql.registerDriver(driver);
                return ql;
            },
            ServiceLifecycle.SCOPED,
        );

        ctx.logger.info('SharedProjectPlugin: registered scoped driver + metadata + objectql factories');

        // Register a ProjectScopeManager so HttpDispatcher can auto-wire TTL eviction
        const kernel = ctx.getKernel() as any;
        const scopeManager = new ProjectScopeManager({
            kernel,
            ttlMs: this.config.scopeTtlMs,
            maxSize: this.config.scopeMaxSize,
        });
        ctx.registerService('scope-manager', scopeManager);
    };
}
