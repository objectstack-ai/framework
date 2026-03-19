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

  async init(ctx: PluginContext): Promise<void> {
    // Register audit system objects so ObjectQLPlugin auto-discovers them
    ctx.registerService('app.com.objectstack.audit', {
      id: 'com.objectstack.audit',
      name: 'Audit',
      version: '1.0.0',
      type: 'plugin',
      namespace: 'sys',
      objects: [SysAuditLog],
    });

    ctx.logger.info('Audit Plugin initialized');
  }
}
