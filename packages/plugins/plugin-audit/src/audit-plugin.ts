// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import type { IDataEngine } from '@objectstack/spec/contracts';
import { SysAuditLog, SysActivity, SysComment, SysAttachment, SysNotification } from '@objectstack/platform-objects/audit';
import { installAuditWriters, type MessagingEmitSurface } from './audit-writers.js';

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
    process.stderr.write('[AuditPlugin] init() called\n');
    // Register audit system objects via the manifest service.
    ctx.getService<{ register(m: any): void }>('manifest').register({
      id: 'com.objectstack.audit',
      name: 'Audit',
      version: '1.0.0',
      type: 'plugin',
      scope: 'system',
      defaultDatasource: 'cloud',
      namespace: 'sys',
      objects: [SysAuditLog, SysActivity, SysComment, SysAttachment, SysNotification],
    });

    ctx.logger.info('Audit Plugin initialized');
  }

  async start(ctx: PluginContext): Promise<void> {
    process.stderr.write('[AuditPlugin] start() called, registering kernel:ready hook\n');
    // ObjectQL engine is only resolvable after the kernel is ready.
    ctx.hook('kernel:ready', async () => {
      process.stderr.write('[AuditPlugin] kernel:ready fired\n');
      let engine: IDataEngine | null = null;
      try {
        engine = ctx.getService<IDataEngine>('objectql');
        process.stderr.write(`[AuditPlugin] objectql engine = ${engine ? 'OK' : 'null'} registerHook? ${typeof (engine as any)?.registerHook}\n`);
      } catch (err) {
        process.stderr.write(`[AuditPlugin] getService(objectql) threw: ${(err as Error).message}\n`);
        // Fallback alias used in some kernels.
        try {
          engine = ctx.getService<IDataEngine>('data');
          process.stderr.write(`[AuditPlugin] data engine = ${engine ? 'OK' : 'null'}\n`);
        } catch { /* ignore */ }
      }
      if (!engine) {
        process.stderr.write('[AuditPlugin] NO ENGINE — bailing\n');
        ctx.logger.warn('AuditPlugin: ObjectQL engine not available — audit writers NOT installed');
        return;
      }
      // Resolve the messaging service lazily at hook time so collaboration
      // @mention / assignment notifications go through the ADR-0030 single
      // ingress (emit) instead of writing sys_notification directly. Messaging
      // may register after audit; lazy resolution tolerates either order.
      const getMessaging = (): MessagingEmitSurface | undefined => {
        try {
          return ctx.getService<MessagingEmitSurface>('messaging');
        } catch {
          return undefined;
        }
      };
      installAuditWriters(engine as any, this.name, { getMessaging });
      process.stderr.write('[AuditPlugin] writers installed\n');
      ctx.logger.info('AuditPlugin: audit + activity writers installed');
    });
  }
}
