// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { PluginContext } from '@objectstack/core';
import { defineActionDescriptor } from '@objectstack/spec/automation';
import type { FlowRegionParsed } from '@objectstack/spec/automation';
import type { AutomationContext } from '@objectstack/spec/contracts';
import type { AutomationEngine } from '../engine.js';

/** One branch of a parallel block — a region plus an optional label. */
interface ParallelBranch extends FlowRegionParsed {
  name?: string;
}

/**
 * `parallel` built-in node — a **structured parallel block** with an
 * **implicit join** (ADR-0031 §Decision 2).
 *
 * The node declares N branch regions in `config.branches[]`; each branch is a
 * self-contained single-entry/single-exit sub-graph (validated at
 * `registerFlow()`). The executor runs every branch concurrently
 * (`Promise.all`) in the **enclosing variable scope** and continues **once when
 * all branches complete** — the join is implicit at block end, engine
 * synchronized. There is no author-visible split/join gateway to mis-wire or
 * deadlock; the node's ordinary out-edges remain the after-block continuation.
 *
 * Concurrency model: JavaScript is single-threaded, so branches interleave only
 * at `await` points and the shared `variables` map is never torn. Branches
 * SHOULD write distinct variables; on a key collision the last writer to settle
 * wins (same semantics as the engine's existing unconditional-edge fan-out).
 *
 * If any branch fails (a node returns `success: false` or throws), the block
 * fails — surfaced as a node failure so the flow's fault edge / error handling
 * applies. Durable pause inside a branch is unsupported (a clear error), mirror-
 * ing the loop container.
 */
export function registerParallelNode(engine: AutomationEngine, ctx: PluginContext): void {
  engine.registerNodeExecutor({
    type: 'parallel',
    descriptor: defineActionDescriptor({
      type: 'parallel',
      version: '1.0.0',
      name: 'Parallel',
      description: 'Run N branch regions concurrently and join implicitly when all complete.',
      icon: 'git-fork',
      category: 'logic',
      source: 'builtin',
      configSchema: {
        type: 'object',
        properties: {
          branches: {
            type: 'array',
            minItems: 2,
            description: 'Branch regions executed concurrently; implicit join at block end',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                nodes: { type: 'array' },
                edges: { type: 'array' },
              },
            },
          },
        },
        required: ['branches'],
      },
    }),
    async execute(node, variables, context) {
      const cfg = (node.config ?? {}) as Record<string, unknown>;
      const branches = cfg.branches as ParallelBranch[] | undefined;

      if (!Array.isArray(branches) || branches.length < 2) {
        return {
          success: false,
          error: `parallel '${node.id}': config.branches must declare at least 2 branch regions`,
        };
      }

      try {
        // Implicit join: continue once when ALL branches have completed.
        await Promise.all(
          branches.map(branch => engine.runRegion(branch, variables, context ?? ({} as AutomationContext))),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: `parallel '${node.id}': branch failed — ${message}` };
      }

      return { success: true, output: { branches: branches.length } };
    },
  });

  ctx.logger.info('[Parallel Node] 1 built-in node executor registered');
}
