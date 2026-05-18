// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import type { IDataEngine } from '@objectstack/spec/contracts';
import { SysAuditLog, SysActivity, SysComment, SysAttachment } from '@objectstack/platform-objects/audit';
import { installAuditWriters } from './audit-writers.js';

/**
 * AuditPlugin
 *
 * Registers the sys_audit_log / sys_activity / sys_comment system objects
 * and installs ObjectQL hook subscribers that automatically write audit
 * trail + activity stream rows on every data mutation.
 *
 * Implements ROADMAP M10.1 (CRM production-readiness).
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
      objects: [SysAuditLog, SysActivity, SysComment, SysAttachment],
    });

    ctx.logger.info('Audit Plugin initialized');
  }

  async start(ctx: PluginContext): Promise<void> {
    // ObjectQL engine is only resolvable after the kernel is ready.
    ctx.hook('kernel:ready', async () => {
      let engine: IDataEngine | null = null;
      try {
        engine = ctx.getService<IDataEngine>('objectql');
      } catch {
        // Fallback alias used in some kernels.
        try { engine = ctx.getService<IDataEngine>('data'); } catch { /* ignore */ }
      }
      if (!engine) {
        ctx.logger.warn('AuditPlugin: ObjectQL engine not available — audit writers NOT installed');
        return;
      }
      installAuditWriters(engine as any, this.name);
      ctx.logger.info('AuditPlugin: audit + activity writers installed');
    });
  }
}
