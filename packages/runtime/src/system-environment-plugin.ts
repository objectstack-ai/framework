// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext } from '@objectstack/core';

/**
 * The well-known UUID for the built-in system project.
 * Kept in lockstep with `ProjectProvisioningService.provisionSystemEnvironment`.
 */
export const SYSTEM_ENVIRONMENT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Minimal surface of `ProjectProvisioningService` consumed by the plugin.
 * Typed locally so the runtime package does not gain a hard dependency on
 * `@objectstack/service-tenant` — the service is discovered at runtime via
 * the kernel service registry.
 */
interface ProvisioningLike {
  provisionSystemEnvironment(): Promise<{
    project: { id: string; isSystem?: boolean };
    warnings?: string[];
  }>;
}

export interface SystemEnvironmentPluginConfig {
  /**
   * Service name that resolves to a `ProjectProvisioningService`-shaped
   * object. Defaults to `tenant.provisioning` (convention used by
   * `@objectstack/service-tenant`).
   */
  serviceName?: string;

  /**
   * When true, plugin treats a missing provisioning service as an error.
   * Defaults to false — bootstrap is opt-in and must no-op gracefully when
   * the tenant package is not part of the stack.
   */
  strict?: boolean;
}

/**
 * System Project Bootstrap Plugin
 *
 * Ensures the built-in system project (well-known UUID
 * {@link SYSTEM_ENVIRONMENT_ID}) exists on the control plane the first time the
 * runtime starts. Calls are idempotent — `provisionSystemEnvironment()` returns
 * the existing row when the project has already been created.
 *
 * Register AFTER the tenant service is available so the provisioning service
 * can be resolved from the kernel.
 *
 * @example
 * ```ts
 * kernel.use(tenantPlugin);
 * kernel.use(createSystemEnvironmentPlugin());
 * ```
 */
export function createSystemEnvironmentPlugin(config: SystemEnvironmentPluginConfig = {}): Plugin {
  const serviceName = config.serviceName ?? 'tenant.provisioning';

  return {
    name: 'com.objectstack.runtime.system-environment',
    version: '1.0.0',

    init: async (_ctx: PluginContext) => {
      // Consumer-only plugin; nothing to register at init-time.
    },

    start: async (ctx: PluginContext) => {
      let service: ProvisioningLike | undefined;
      try {
        service = ctx.getService<ProvisioningLike>(serviceName);
      } catch {
        // Service registry throws when the key is not found.
        service = undefined;
      }

      if (!service || typeof service.provisionSystemEnvironment !== 'function') {
        if (config.strict) {
          throw new Error(
            `[SystemEnvironmentPlugin] Provisioning service '${serviceName}' not found — cannot bootstrap system project.`,
          );
        }
        ctx.logger.debug(
          `[SystemEnvironmentPlugin] Provisioning service '${serviceName}' unavailable — system project bootstrap skipped.`,
        );
        return;
      }

      try {
        const result = await service.provisionSystemEnvironment();
        const warnings = result.warnings ?? [];
        ctx.logger.info('[SystemEnvironmentPlugin] System project ready', {
          environmentId: result.project.id,
          isSystem: result.project.isSystem,
          warnings,
        });
      } catch (err: any) {
        if (config.strict) throw err;
        ctx.logger.warn('[SystemEnvironmentPlugin] Failed to provision system project', {
          error: err?.message ?? String(err),
        });
      }
    },
  };
}
