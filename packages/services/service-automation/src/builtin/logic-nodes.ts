// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { PluginContext } from '@objectstack/core';
import { defineActionDescriptor } from '@objectstack/spec/automation';
import type { AutomationEngine } from '../engine.js';

/**
 * Logic built-in nodes — decision / assignment.
 *
 * (The `loop` container is registered separately — see `loop-node.ts` — as a
 * structured iteration construct per ADR-0031.)
 *
 * Part of the automation engine's foundational vocabulary, so the core
 * {@link AutomationServicePlugin} seeds them directly (ADR-0018). These are NOT
 * shipped as a separately installable plugin — "plugins are plugins; the
 * platform's foundational capabilities are built in." Third-party node types
 * are still registered via `engine.registerNodeExecutor()`.
 */
export function registerLogicNodes(engine: AutomationEngine, ctx: PluginContext): void {
        // decision node — conditional branching
        engine.registerNodeExecutor({
            type: 'decision',
            descriptor: defineActionDescriptor({
                type: 'decision', version: '1.0.0', name: 'Decision',
                description: 'Branch execution based on conditions.',
                icon: 'git-branch', category: 'logic', source: 'builtin',
            }),
            async execute(node, variables, _context) {
                const config = node.config as Record<string, unknown> | undefined;
                const conditions = (config?.conditions ?? []) as Array<{ label: string; expression: string }>;

                for (const cond of conditions) {
                    if (engine.evaluateCondition(cond.expression, variables)) {
                        return { success: true, branchLabel: cond.label };
                    }
                }
                return { success: true, branchLabel: 'default' };
            },
        });

        // assignment node — set variables
        engine.registerNodeExecutor({
            type: 'assignment',
            descriptor: defineActionDescriptor({
                type: 'assignment', version: '1.0.0', name: 'Assignment',
                description: 'Set flow variables.',
                icon: 'variable', category: 'logic', source: 'builtin',
            }),
            async execute(node, variables, _context) {
                const config = (node.config ?? {}) as Record<string, unknown>;
                for (const [key, value] of Object.entries(config)) {
                    variables.set(key, value);
                }
                return { success: true };
            },
        });

        ctx.logger.info('[Logic Nodes] 2 built-in node executors registered');
}
