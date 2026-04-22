// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/spec';
import type { TenantRoutingConfig } from '@objectstack/spec/cloud';
import { TenantContextService } from './tenant-context';
import {
  createDefaultProjectAdapters,
  type ProjectDatabaseAdapter,
} from './project-provisioning.js';
import {
  SysTenantDatabase,
  SysPackage,
  SysPackageVersion,
  SysPackageInstallation,
  SysProject,
  SysProjectCredential,
  SysProjectMember,
} from './objects';

/**
 * Tenant Plugin Configuration
 */
export interface TenantPluginConfig {
  /**
   * Tenant routing configuration
   */
  routing?: TenantRoutingConfig;

  /**
   * Register system objects (for global control plane)
   * Default: true
   */
  registerSystemObjects?: boolean;

  /**
   * Register the v4.x deprecated `sys_tenant_database` shim.
   * Default: true (for backwards compatibility).
   *
   * Set to false in greenfield deployments.
   */
  registerLegacyTenantDatabase?: boolean;
}

/**
 * Tenant Plugin
 *
 * Registers the tenant context service with the ObjectKernel.
 * Provides multi-tenant routing and context management.
 * Optionally registers system objects for the global control plane.
 */
export function createTenantPlugin(config: TenantPluginConfig = {}): Plugin {
  let service: TenantContextService | null = null;

  return {
    name: '@objectstack/service-tenant',
    version: '0.2.0',
    // NOTE: System objects are registered inside `init()` via the `manifest`
    // service — the kernel does NOT consume a top-level `objects:` field on
    // plugins added via `kernel.use(plugin)`. Only nested plugins inside a
    // parent manifest are picked up that way (see
    // `packages/objectql/src/engine.ts` → `registerPlugin()`).
    //
    // Without going through the manifest service, schemas never reach
    // `SchemaRegistry`, which means `ObjectQL.getDriver()` cannot match the
    // `namespace: 'sys' → turso` datasourceMapping rule and silently falls
    // back to the default driver — losing every write across lambda
    // invocations on Vercel.

    async init(ctx: PluginContext) {
      // Register the physical-DB adapter registry so HTTP dispatcher can
      // actually allocate real databases when a client calls POST /cloud/projects.
      const anyCtx = ctx as any;
      const adapters: ProjectDatabaseAdapter[] = createDefaultProjectAdapters(process.env);
      const adapterRegistry = {
        get(driverName: string): ProjectDatabaseAdapter | undefined {
          return adapters.find((a) => a.driver === driverName);
        },
        list(): ProjectDatabaseAdapter[] {
          return [...adapters];
        },
      };
      if (typeof anyCtx.registerService === 'function') {
        anyCtx.registerService('project-provisioning-adapters', adapterRegistry);
      } else if (anyCtx.kernel?.registerService) {
        anyCtx.kernel.registerService('project-provisioning-adapters', adapterRegistry);
      } else {
        console.warn('[TenantPlugin] No registerService on context; adapter registry NOT installed');
      }
      console.log('[TenantPlugin] Project provisioning adapters registered', {
        drivers: adapters.map((a) => a.driver),
      });

      // Create tenant context service if routing is configured
      if (config.routing) {
        service = new TenantContextService(config.routing);

        ctx.kernel.registerService('tenant', service, {
          lifecycle: 'SINGLETON',
        });

        ctx.logger.info('[TenantPlugin] Tenant routing initialized', {
          enabled: config.routing.enabled,
          sources: config.routing.identificationSources,
        });
      }

      if (config.registerSystemObjects !== false) {
        // Register system objects via the `manifest` service. This is the
        // ONLY supported path — see the class-level note above for why a
        // top-level `objects:` field on the plugin object would be silently
        // ignored. Mirrors the convention used by AuthPlugin / SecurityPlugin
        // / SetupPlugin / etc.
        const manifestObjects: any[] = [
          // Control-plane objects (project-per-database model).
          SysProject,
          SysProjectCredential,
          SysProjectMember,
          // Package registry (ADR-0003).
          SysPackage,
          SysPackageVersion,
          SysPackageInstallation,
        ];
        if (config.registerLegacyTenantDatabase !== false) {
          // v4.x deprecation shim — opt out via `registerLegacyTenantDatabase: false`.
          manifestObjects.push(SysTenantDatabase);
        }

        try {
          const manifestService = ctx.getService<{ register(m: any): void }>('manifest');
          manifestService.register({
            id: 'com.objectstack.tenant',
            name: 'Tenant',
            version: '0.2.0',
            type: 'plugin',
            scope: 'platform',
            namespace: 'sys',
            objects: manifestObjects,
          });
          ctx.logger.info('[TenantPlugin] System objects registered via manifest service', {
            objects: manifestObjects.map((o: any) => `${o?.namespace ?? 'sys'}__${o?.name}`),
          });
        } catch (err: any) {
          // Without the manifest service we cannot register schemas — fail
          // loudly because every downstream control-plane write would
          // silently route to the default driver and lose data on cold
          // starts (see Vercel "create project then 404" failure mode).
          throw new Error(
            `[TenantPlugin] Failed to register system objects via manifest service. ` +
              `Ensure ObjectQLPlugin is registered before TenantPlugin. Cause: ${err?.message ?? String(err)}`,
          );
        }
      }
    },

    async start(ctx: PluginContext) {
      ctx.logger.info('[TenantPlugin] Started');
    },

    async destroy(ctx: PluginContext) {
      if (service) {
        service.clearCache();
      }
      ctx.logger.info('[TenantPlugin] Destroyed');
    },
  };
}
