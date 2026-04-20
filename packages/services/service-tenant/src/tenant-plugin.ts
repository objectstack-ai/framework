// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/spec';
import type { TenantRoutingConfig } from '@objectstack/spec/cloud';
import { TenantContextService } from './tenant-context';
import {
  SysTenantDatabase,
  SysPackageInstallation,
  SysEnvironment,
  SysDatabaseCredential,
  SysEnvironmentMember,
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
   * Register the v4.x deprecated `sys_tenant_database` shim alongside the
   * v4.1+ environment objects. Default: true (for backwards compatibility).
   *
   * Set to false in greenfield deployments that never stored data under
   * the legacy per-organization model. Will default to `false` in v5.0
   * and be removed entirely thereafter.
   *
   * @see docs/adr/0002-environment-database-isolation.md
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
          // Control-plane objects (environment-per-database model).
          SysEnvironment,
          SysDatabaseCredential,
          SysEnvironmentMember,
          SysPackageInstallation,
          // v4.x deprecation shim — opt out via `registerLegacyTenantDatabase: false`.
          ...(config.registerLegacyTenantDatabase !== false ? [SysTenantDatabase] : []),
        ]
      : [],

    async init(ctx: PluginContext) {
      // Create tenant context service if routing is configured
      if (config.routing) {
        service = new TenantContextService(config.routing);

        // Register service
        ctx.kernel.registerService('tenant', service, {
          lifecycle: 'SINGLETON',
        });

        ctx.logger.info('[TenantPlugin] Tenant routing initialized', {
          enabled: config.routing.enabled,
          sources: config.routing.identificationSources,
        });
      }

      // Register system objects if enabled
      if (config.registerSystemObjects !== false) {
        const registered = [
          'sys_environment',
          'sys_database_credential',
          'sys_environment_member',
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
