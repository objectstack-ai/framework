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

    objects: config.registerSystemObjects !== false
      ? [
          // Control-plane objects (project-per-database model).
          SysProject,
          SysProjectCredential,
          SysProjectMember,
          // Package registry (ADR-0003).
          SysPackage,
          SysPackageVersion,
          SysPackageInstallation,
          // v4.x deprecation shim — opt out via `registerLegacyTenantDatabase: false`.
          ...(config.registerLegacyTenantDatabase !== false ? [SysTenantDatabase] : []),
        ]
      : [],

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
        const registered = [
          'sys_project',
          'sys_project_credential',
          'sys_project_member',
          'sys_package',
          'sys_package_version',
          'sys_package_installation',
        ];
        if (config.registerLegacyTenantDatabase !== false) {
          registered.push('sys_tenant_database (deprecated)');
        }
        ctx.logger.info('[TenantPlugin] System objects registered', { objects: registered });
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
