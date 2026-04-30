// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import { SysAuditLog, SysActivity, SysComment } from '@objectstack/platform-objects/audit';

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
      scope: 'system',
      defaultDatasource: 'cloud',
      namespace: 'sys',
      objects: [SysAuditLog, SysActivity, SysComment],
    });

    ctx.logger.info('Audit Plugin initialized');
  }
}
