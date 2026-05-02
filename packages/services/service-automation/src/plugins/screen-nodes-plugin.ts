// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import type { AutomationEngine } from '../engine.js';

/**
 * Screen / Script Node Plugin — Provides 'screen' and 'script' executors.
 *
 * - 'screen' nodes are pass-through on the server. The engine already injects
 *   `isInput: true` flow variables from `context.params` into the top-level
 *   variables map before execution begins, so screen nodes have no remaining
 *   server-side work.
 * - 'script' nodes dispatch by `config.actionType`. Currently only 'email'
 *   has a (logger-backed) implementation; unknown action types still succeed
 *   so flows can continue and downstream nodes can react.
 *
 * Dependencies: service-automation (engine)
 */
export class ScreenNodesPlugin implements Plugin {
  name = 'com.objectstack.automation.screen-nodes';
  version = '1.0.0';
  type = 'standard' as const;
  dependencies = ['com.objectstack.service-automation'];

  async init(ctx: PluginContext): Promise<void> {
    const engine = ctx.getService<AutomationEngine>('automation');

    // screen — server-side pass-through (input vars already injected by engine).
    engine.registerNodeExecutor({
      type: 'screen',
      async execute(_node, _variables, _context) {
        return { success: true };
      },
    });

    // script — dispatch by actionType.
    engine.registerNodeExecutor({
      type: 'script',
      async execute(node, _variables, _context) {
        const cfg = (node.config ?? {}) as Record<string, unknown>;
        const actionType = (cfg.actionType as string | undefined) ?? 'noop';
        if (actionType === 'email') {
          ctx.logger.info(
            `[Script:email] template=${String(cfg.template)} ` +
              `recipients=${JSON.stringify(cfg.recipients)} ` +
              `vars=${JSON.stringify(cfg.variables)}`,
          );
          return {
            success: true,
            output: {
              actionType,
              template: cfg.template,
              recipients: cfg.recipients,
            },
          };
        }
        ctx.logger.info(`[Script:${actionType}] node=${node.id} executed (no-op handler)`);
        return { success: true, output: { actionType } };
      },
    });

    ctx.logger.info('[Screen/Script Nodes] 2 node executors registered');
  }
}
