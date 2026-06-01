// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { PluginContext } from '@objectstack/core';
import { defineActionDescriptor } from '@objectstack/spec/automation';
import type { AutomationEngine } from '../engine.js';

/**
 * Screen / Script built-in nodes — 'screen' and 'script' executors.
 * Part of the core flow capability, so the {@link AutomationServicePlugin}
 * seeds them directly (ADR-0018) rather than shipping a separate plugin.
 *
 * - 'screen' nodes collect user input. A screen that declares `config.fields`
 *   (or sets `config.waitForInput === true`) suspends the run on entry via the
 *   engine's durable pause (ADR-0019), surfacing a `ScreenSpec` for the client
 *   to render; the run continues via `resume()` with the collected values (set
 *   as bare flow variables). A field-less screen — or one with
 *   `waitForInput === false` — stays a server pass-through (input vars, if any,
 *   are already injected from `context.params`).
 * - 'script' nodes dispatch by `config.actionType`. Currently only 'email'
 *   has a (logger-backed) implementation; unknown action types still succeed
 *   so flows can continue and downstream nodes can react.
 */
export function registerScreenNodes(engine: AutomationEngine, ctx: PluginContext): void {
    // screen — server-side pass-through (input vars already injected by engine).
    engine.registerNodeExecutor({
      type: 'screen',
      descriptor: defineActionDescriptor({
        type: 'screen', version: '1.0.0', name: 'Screen',
        description: 'Collect user input via a screen (human-input element).',
        icon: 'window', category: 'human', source: 'builtin',
        // Human-input nodes suspend the flow awaiting input.
        supportsPause: true, isAsync: true,
      }),
      async execute(node, _variables, _context) {
        const cfg = (node.config ?? {}) as Record<string, unknown>;
        const rawFields = Array.isArray(cfg.fields) ? (cfg.fields as Array<Record<string, unknown>>) : [];
        const hasFields = rawFields.length > 0;
        // Suspend to collect input when the screen declares fields, or opts in
        // explicitly. `waitForInput === false` forces a server pass-through.
        const shouldPause = cfg.waitForInput === true || (hasFields && cfg.waitForInput !== false);
        if (!shouldPause) {
          return { success: true };
        }
        const fields = rawFields.map((f) => ({
          name: String(f.name ?? ''),
          label: f.label != null ? String(f.label) : undefined,
          type: f.type != null ? String(f.type) : undefined,
          required: f.required === true,
          options: Array.isArray(f.options) ? (f.options as Array<{ value: unknown; label: string }>) : undefined,
          defaultValue: f.defaultValue,
          placeholder: f.placeholder != null ? String(f.placeholder) : undefined,
        })).filter((f) => f.name.length > 0);
        return {
          success: true,
          suspend: true,
          screen: {
            nodeId: node.id,
            title: (cfg.title as string | undefined) ?? node.label ?? 'Input',
            description: cfg.description as string | undefined,
            fields,
          },
        };
      },
    });

    // script — dispatch by actionType.
    engine.registerNodeExecutor({
      type: 'script',
      descriptor: defineActionDescriptor({
        type: 'script', version: '1.0.0', name: 'Script',
        description: 'Run a custom script action.',
        icon: 'code', category: 'logic', source: 'builtin',
      }),
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

    ctx.logger.info('[Screen/Script Nodes] 2 built-in node executors registered');
}
