// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import { AutomationEngine } from './engine.js';

/**
 * Configuration options for the AutomationServicePlugin.
 */
export interface AutomationServicePluginOptions {
    /** Enable debug logging for flow execution */
    debug?: boolean;
}

/**
 * AutomationServicePlugin — Core engine plugin
 *
 * Responsibilities:
 * 1. init phase: Create engine instance, register as 'automation' service
 * 2. start phase: Trigger 'automation:ready' hook for node plugin registration,
 *    then pull flow definitions from the ObjectQL schema registry and register
 *    them with the engine.
 * 3. destroy phase: Clean up resources
 *
 * Does NOT implement any specific nodes — nodes are registered by other plugins
 * via the engine's extension API.
 *
 * @example
 * ```ts
 * import { LiteKernel } from '@objectstack/core';
 * import { AutomationServicePlugin } from '@objectstack/service-automation';
 *
 * const kernel = new LiteKernel();
 * kernel.use(new AutomationServicePlugin());
 * await kernel.bootstrap();
 *
 * const automation = kernel.getService('automation');
 * ```
 */
export class AutomationServicePlugin implements Plugin {
    name = 'com.objectstack.service-automation';
    version = '1.0.0';
    type = 'standard' as const;
    // Soft dependency on metadata: we look it up at start() and tolerate absence.
    // Do NOT declare a hard kernel dependency, so this plugin works in environments
    // where MetadataPlugin is not registered.
    dependencies: string[] = [];

    private engine?: AutomationEngine;
    private readonly options: AutomationServicePluginOptions;

    constructor(options: AutomationServicePluginOptions = {}) {
        this.options = options;
    }

    async init(ctx: PluginContext): Promise<void> {
        this.engine = new AutomationEngine(ctx.logger);

        // Register as global service — other plugins access via ctx.getService('automation')
        ctx.registerService('automation', this.engine);

        if (this.options.debug) {
            ctx.hook('automation:beforeExecute', async (flowName: string) => {
                ctx.logger.debug(`[Automation] Before execute: ${flowName}`);
            });
        }

        ctx.logger.info('[Automation] Engine initialized');
    }

    async start(ctx: PluginContext): Promise<void> {
        if (!this.engine) return;

        // Trigger hook to notify engine is ready — other plugins can start registering nodes
        await ctx.trigger('automation:ready', this.engine);

        const nodeTypes = this.engine.getRegisteredNodeTypes();
        ctx.logger.info(
            `[Automation] Engine started with ${nodeTypes.length} node types: ${nodeTypes.join(', ') || '(none)'}`,
        );

        // Pull flow definitions from the ObjectQL schema registry. AppPlugin.init()
        // calls manifest.register(payload), which routes to ql.registerApp() and
        // stores each inline flow under type 'flow'. By the time start() runs,
        // every init() phase has completed, so the registry is fully populated.
        try {
            const ql = ctx.getService<{
                registry?: { listItems?: (type: string) => unknown[] };
            }>('objectql');
            if (!ql) {
                ctx.logger.warn('[Automation] objectql service not found at start()');
            } else if (!ql.registry) {
                ctx.logger.warn('[Automation] objectql.registry is undefined at start()');
            } else if (typeof ql.registry.listItems !== 'function') {
                ctx.logger.warn('[Automation] objectql.registry.listItems is not a function');
            }
            const flows = ql?.registry?.listItems?.('flow') ?? [];
            ctx.logger.warn(`[Automation] flow pull: registry returned ${flows.length} flow(s)`);
            let registered = 0;
            for (const f of flows) {
                const def = f as { name?: string };
                if (!def?.name) continue;
                try {
                    this.engine.registerFlow(def.name, def as never);
                    registered++;
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    ctx.logger.warn(`[Automation] failed to register flow ${def.name}: ${msg}`);
                }
            }
            if (registered > 0) {
                ctx.logger.info(`[Automation] Pulled ${registered} flow(s) from ObjectQL registry`);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ctx.logger.warn(`[Automation] flow pull from ObjectQL registry failed: ${msg}`);
        }
    }

    async destroy(): Promise<void> {
        this.engine = undefined;
    }
}
