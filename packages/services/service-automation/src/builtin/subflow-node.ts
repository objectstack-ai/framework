// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { PluginContext } from '@objectstack/core';
import { defineActionDescriptor } from '@objectstack/spec/automation';
import type { AutomationContext } from '@objectstack/spec/contracts';
import type { AutomationEngine } from '../engine.js';
import { interpolate } from './template.js';

/** Hard cap on subflow nesting — turns an accidental cycle into a clean error. */
const MAX_SUBFLOW_DEPTH = 16;

/**
 * `subflow` built-in node — invoke another flow as a step (reuse / DRY).
 *
 * Resolves `config.input` (a `{token}` mapping) against the parent's variables,
 * runs `config.flowName` via the engine, and writes the child's output back to
 * the parent — under `${nodeId}.output`, and under `config.outputVariable` as a
 * bare variable when given.
 *
 * Scope (v1): **synchronous** subflows that run to completion. If the child
 * *suspends* (a nested `approval` / `screen` / `wait`), the node fails with a
 * clear message rather than silently dropping the run — nested durable pause is
 * a deliberate follow-up. A depth guard ({@link MAX_SUBFLOW_DEPTH}) turns an
 * accidental recursive cycle into a clean error instead of a stack overflow.
 */
export function registerSubflowNode(engine: AutomationEngine, ctx: PluginContext): void {
  engine.registerNodeExecutor({
    type: 'subflow',
    descriptor: defineActionDescriptor({
      type: 'subflow',
      version: '1.0.0',
      name: 'Subflow',
      description: 'Invoke another flow as a reusable step and capture its output.',
      icon: 'workflow',
      category: 'logic',
      source: 'builtin',
    }),
    async execute(node, variables, context) {
      const cfg = (node.config ?? {}) as Record<string, unknown>;
      const flowName =
        typeof cfg.flowName === 'string' ? cfg.flowName : typeof cfg.flow === 'string' ? cfg.flow : undefined;
      if (!flowName) {
        return { success: false, error: `subflow '${node.id}': config.flowName is required` };
      }

      // Cycle guard: depth rides on the context so it accumulates across nesting.
      const depth = Number((context as { $subflowDepth?: number } | undefined)?.$subflowDepth ?? 0);
      if (depth >= MAX_SUBFLOW_DEPTH) {
        return {
          success: false,
          error: `subflow '${flowName}': max nesting depth (${MAX_SUBFLOW_DEPTH}) exceeded — recursive subflow?`,
        };
      }

      // Map inputs (resolve `{var}` against the parent's variables/context).
      const rawInput = (cfg.input && typeof cfg.input === 'object' ? cfg.input : {}) as Record<string, unknown>;
      const params = interpolate(rawInput, variables, context ?? ({} as AutomationContext)) as Record<string, unknown>;

      const childContext = {
        ...(context ?? {}),
        $subflowDepth: depth + 1,
        params,
      } as AutomationContext;

      const child = await engine.execute(flowName, childContext);

      if (child.status === 'paused') {
        return {
          success: false,
          error:
            `subflow '${flowName}' suspended at a pausing node — a nested approval/screen/wait ` +
            `pause from a subflow is not yet supported`,
        };
      }
      if (!child.success) {
        return { success: false, error: `subflow '${flowName}' failed: ${child.error ?? 'unknown error'}` };
      }

      // Bare output variable (like the assignment node, the executor may write
      // directly to the parent variable map).
      const outVar = typeof cfg.outputVariable === 'string' && cfg.outputVariable ? cfg.outputVariable : undefined;
      if (outVar) variables.set(outVar, child.output ?? null);

      return { success: true, output: { output: child.output ?? null } };
    },
  });

  ctx.logger.info('[Subflow Node] 1 built-in node executor registered');
}
