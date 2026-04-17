// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/spec';
import type { TenantRoutingConfig } from '@objectstack/spec/cloud';
import { TenantContextService } from './tenant-context';

/**
 * Tenant Plugin
 *
 * Registers the tenant context service with the ObjectKernel.
 * Provides multi-tenant routing and context management.
 */
export function createTenantPlugin(config: TenantRoutingConfig): Plugin {
  let service: TenantContextService | null = null;

  return {
    name: '@objectstack/service-tenant',
    version: '0.1.0',

    async init(ctx: PluginContext) {
      // Create tenant context service
      service = new TenantContextService(config);

      // Register service
      ctx.kernel.registerService('tenant', service, {
        lifecycle: 'SINGLETON',
      });

      ctx.logger.info('[TenantPlugin] Initialized', {
        enabled: config.enabled,
        sources: config.identificationSources,
      });
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
