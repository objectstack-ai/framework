// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import {
  SysApprovalProcess,
  SysApprovalRequest,
  SysApprovalAction,
} from '@objectstack/platform-objects/audit';
import { ApprovalService, type ApprovalEngine } from './approval-service.js';
import { bindProcessHooks, unbindAllHooks } from './lifecycle-hooks.js';
import { registerApprovalNode, type ApprovalAutomationSurface } from './approval-node.js';

export interface ApprovalsPluginOptions {
  /** Disable runtime registration (schemas still register). */
  disableService?: boolean;
  /**
   * Disable Phase B auto-trigger / lock hooks. Schema definition stays
   * intact; only the engine-level wiring is suppressed. Useful when a
   * caller wants the manual API only (e.g. tests).
   */
  disableAutoHooks?: boolean;
}

/**
 * ApprovalsServicePlugin — registers sys_approval_{process,request,action},
 * the `approvals` service, and Phase B lifecycle hooks (auto-trigger,
 * record lock, status mirror). SLA escalation dispatcher is a later
 * milestone.
 */
export class ApprovalsServicePlugin implements Plugin {
  name = 'com.objectstack.service.approvals';
  version = '1.0.0';
  type = 'standard';
  dependencies = ['com.objectstack.engine.objectql'];

  private readonly options: ApprovalsPluginOptions;
  private service?: ApprovalService;
  private engine?: any;
  private logger?: any;

  constructor(options: ApprovalsPluginOptions = {}) {
    this.options = options;
  }

  async init(ctx: PluginContext): Promise<void> {
    ctx.getService<{ register(m: any): void }>('manifest').register({
      id: 'com.objectstack.service.approvals',
      name: 'Approvals Service',
      version: '1.0.0',
      type: 'plugin',
      scope: 'system',
      defaultDatasource: 'cloud',
      namespace: 'sys',
      objects: [SysApprovalProcess, SysApprovalRequest, SysApprovalAction],
    });
    ctx.logger.info('ApprovalsServicePlugin: schemas registered');
  }

  async start(ctx: PluginContext): Promise<void> {
    if (this.options.disableService) return;
    let engine: any = null;
    try { engine = ctx.getService<any>('objectql'); }
    catch { try { engine = ctx.getService<any>('data'); } catch { /* ignore */ } }
    if (!engine) {
      ctx.logger.warn('ApprovalsServicePlugin: no ObjectQL engine — service NOT registered');
      return;
    }
    this.engine = engine;
    this.logger = ctx.logger;

    // ADR-0009: try to wire the metadata repository for execution pinning.
    // The approvals service degrades to the projection-table path if no
    // metadata service is registered (e.g. in tests or minimal setups).
    let metadataRepo: any;
    try {
      const meta = ctx.getService<any>('metadata');
      metadataRepo = meta?.getRepository?.();
    } catch { /* metadata plugin not loaded — fall back */ }

    this.service = new ApprovalService({
      engine: engine as ApprovalEngine,
      logger: ctx.logger,
      metadataRepo,
    });

    if (metadataRepo) {
      ctx.logger.info('ApprovalsServicePlugin: execution pinning enabled (ADR-0009)');
    }

    if (!this.options.disableAutoHooks) {
      // Re-bind hooks on every registry mutation.
      this.service.setRegistryChangeHandler(() => this.rebindHooks());
      // Initial bind happens once the kernel is ready so the AppPlugin's
      // declarative process seeder has already populated sys_approval_process.
      const hookOn = (ctx as any).hook ?? (ctx as any).on;
      if (typeof hookOn === 'function') {
        try {
          hookOn.call(ctx, 'kernel:ready', async () => { await this.rebindHooks(); });
        } catch {
          // Fall through to immediate bind (no kernel:ready event).
          await this.rebindHooks();
        }
      } else {
        await this.rebindHooks();
      }
    }

    ctx.registerService('approvals', this.service);
    ctx.logger.info('ApprovalsServicePlugin: service registered');

    // ADR-0019: contribute the `approval` node to the flow engine when one is
    // present. Optional — the manual approval API works without it; this is the
    // bridge that lets a flow suspend on an Approval node and resume on decision.
    try {
      const automation = ctx.getService<ApprovalAutomationSurface>('automation');
      if (automation && typeof automation.registerNodeExecutor === 'function') {
        registerApprovalNode(automation, this.service, ctx.logger);
      }
    } catch {
      ctx.logger.info('ApprovalsServicePlugin: no automation engine — approval node not registered');
    }
  }

  private async rebindHooks(): Promise<void> {
    if (!this.engine || !this.service) return;
    try {
      unbindAllHooks(this.engine);
      const processes = await this.service.listProcesses({ activeOnly: true }, { isSystem: true, roles: [], permissions: [] } as any);
      bindProcessHooks(this.engine, this.service, processes, this.logger);
    } catch (err: any) {
      this.logger?.warn?.('[approvals] rebindHooks failed', { error: err?.message });
    }
  }

  async stop(_ctx: PluginContext): Promise<void> {
    if (this.engine) {
      try { unbindAllHooks(this.engine); } catch { /* ignore */ }
    }
  }
}

