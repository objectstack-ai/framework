// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { PluginContext } from '@objectstack/core';
import { defineActionDescriptor } from '@objectstack/spec/automation';
import type { FlowRegionParsed } from '@objectstack/spec/automation';
import type { AutomationContext } from '@objectstack/spec/contracts';
import type { AutomationEngine } from '../engine.js';

interface RetryPolicy {
  maxRetries?: number;
  retryDelayMs?: number;
  backoffMultiplier?: number;
  maxRetryDelayMs?: number;
  jitter?: boolean;
}

/**
 * `try_catch` built-in node — **structured try/catch/retry** (ADR-0031 §Decision 3).
 *
 * Runs the protected `try` region; if it throws (a node fails), an optional
 * `retry` policy re-runs the `try` region with exponential backoff. If the
 * region still fails after retries, the optional `catch` region runs with the
 * caught error bound to `errorVariable` (default `$error`). Both regions are
 * self-contained single-entry/single-exit sub-graphs validated at
 * `registerFlow()`, executed in the **enclosing variable scope** via
 * {@link AutomationEngine.runRegion}.
 *
 * Outcome:
 *  - `try` (or a retry) succeeds → the node succeeds, downstream continues.
 *  - `try` exhausts retries, a `catch` is present and succeeds → the node
 *    succeeds (the error was handled).
 *  - `try` exhausts retries and there is **no** `catch` (or `catch` itself
 *    fails) → the node fails, surfacing to the flow's fault edge / error handling.
 *
 * This is the low-code-native error model — the same `fault` + exponential-
 * backoff retry the engine already implements, surfaced as a construct rather
 * than BPMN boundary events.
 */
export function registerTryCatchNode(engine: AutomationEngine, ctx: PluginContext): void {
  engine.registerNodeExecutor({
    type: 'try_catch',
    descriptor: defineActionDescriptor({
      type: 'try_catch',
      version: '1.0.0',
      name: 'Try / Catch',
      description: 'Run a protected region with optional retry and a catch handler (structured error handling).',
      icon: 'shield-alert',
      category: 'logic',
      source: 'builtin',
      supportsRetry: true,
      configSchema: {
        type: 'object',
        properties: {
          try: {
            type: 'object',
            description: 'Protected region (single-entry/single-exit sub-graph)',
            properties: { nodes: { type: 'array' }, edges: { type: 'array' } },
          },
          catch: {
            type: 'object',
            description: 'Handler region run when the try region fails',
            properties: { nodes: { type: 'array' }, edges: { type: 'array' } },
          },
          errorVariable: { type: 'string', description: 'Variable holding the caught error in the catch region' },
          retry: {
            type: 'object',
            properties: {
              maxRetries: { type: 'integer', minimum: 0, maximum: 10 },
              retryDelayMs: { type: 'integer', minimum: 0 },
              backoffMultiplier: { type: 'number', minimum: 1 },
              maxRetryDelayMs: { type: 'integer', minimum: 0 },
              jitter: { type: 'boolean' },
            },
          },
        },
        required: ['try'],
      },
    }),
    async execute(node, variables, context) {
      const cfg = (node.config ?? {}) as Record<string, unknown>;
      const tryRegion = cfg.try as FlowRegionParsed | undefined;
      const catchRegion = cfg.catch as FlowRegionParsed | undefined;
      const errorVariable =
        typeof cfg.errorVariable === 'string' && cfg.errorVariable ? cfg.errorVariable : '$error';
      const retry = (cfg.retry ?? {}) as RetryPolicy;

      if (tryRegion == null) {
        return { success: false, error: `try_catch '${node.id}': config.try region is required` };
      }

      const ctxOrEmpty = context ?? ({} as AutomationContext);
      const maxRetries = typeof retry.maxRetries === 'number' ? retry.maxRetries : 0;
      const baseDelay = typeof retry.retryDelayMs === 'number' ? retry.retryDelayMs : 0;
      const multiplier = typeof retry.backoffMultiplier === 'number' ? retry.backoffMultiplier : 1;
      const maxDelay = typeof retry.maxRetryDelayMs === 'number' ? retry.maxRetryDelayMs : 30000;
      const useJitter = retry.jitter === true;

      // Run the try region, retrying with exponential backoff up to maxRetries.
      let lastError = 'unknown error';
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          let delay = Math.min(baseDelay * Math.pow(multiplier, attempt - 1), maxDelay);
          if (useJitter) delay = delay * (0.5 + Math.random() * 0.5);
          if (delay > 0) await new Promise(r => setTimeout(r, delay));
        }
        try {
          await engine.runRegion(tryRegion, variables, ctxOrEmpty);
          return { success: true, output: { attempts: attempt + 1, caught: false } };
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
        }
      }

      // The try region (and any retries) failed. Run the catch handler if present.
      if (catchRegion != null) {
        variables.set(errorVariable, { nodeId: node.id, message: lastError });
        try {
          await engine.runRegion(catchRegion, variables, ctxOrEmpty);
          return { success: true, output: { attempts: maxRetries + 1, caught: true, error: lastError } };
        } catch (catchErr) {
          const catchMsg = catchErr instanceof Error ? catchErr.message : String(catchErr);
          return { success: false, error: `try_catch '${node.id}': catch region failed — ${catchMsg}` };
        }
      }

      // No catch handler — surface the failure to the flow's fault edge / error handling.
      return { success: false, error: `try_catch '${node.id}': try region failed — ${lastError}` };
    },
  });

  ctx.logger.info('[TryCatch Node] 1 built-in node executor registered');
}
