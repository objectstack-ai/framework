// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import { SysAuditLog } from './objects/index.js';

/**
 * AuditPlugin
 *
 * Registers the sys_audit_log system object with ObjectQL so it is
 * discoverable by the studio and available for CRUD operations.
 */
export class AuditPlugin implements Plugin {
  name = 'com.objectstack.audit';
  type = 'standard';
  version = '1.0.0';
  dependencies = ['com.objectstack.engine.objectql'];

  async init(ctx: PluginContext): Promise<void> {
    // Register audit system objects via the manifest service.
    ctx.getService<{ register(m: any): void }>('manifest').register({
      id: 'com.objectstack.audit',
      name: 'Audit',
      version: '1.0.0',
      type: 'plugin',
      namespace: 'sys',
      objects: [SysAuditLog],
    });

    // Contribute navigation items to the Setup App (if SetupPlugin is loaded).
    try {
      const setupNav = ctx.getService<{ contribute(c: any): void }>('setupNav');
      if (setupNav) {
        setupNav.contribute({
          areaId: 'area_system',
          items: [
            { id: 'nav_audit_logs', type: 'object', label: 'Audit Logs', objectName: 'sys__audit_log', icon: 'scroll-text', order: 10 },
          ],
        });
        ctx.logger.info('Audit navigation items contributed to Setup App');
      }
    } catch {
      // SetupPlugin not loaded — skip silently
    }

    ctx.logger.info('Audit Plugin initialized');
  }
}
