// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import { AutomationEngine } from './engine.js';
import { installBuiltinNodes } from './builtin/index.js';
import { SysAutomationRun } from './sys-automation-run.object.js';
import { ObjectStoreSuspendedRunStore, type SuspendedRunStoreEngine } from './suspended-run-store.js';

/**
 * Configuration options for the AutomationServicePlugin.
 */
export interface AutomationServicePluginOptions {
    /** Enable debug logging for flow execution */
    debug?: boolean;
    /**
     * Durable suspended-run persistence (ADR-0019):
     *  - `'auto'` (default): persist to `sys_automation_run` via the ObjectQL
     *    engine when one is available, otherwise stay in-memory.
     *  - `'memory'`: never persist — keep suspended runs in memory only (the
     *    historical behaviour; suitable for tests / single-process dev).
     *
     * When persistence is on, a run paused at an approval / wait / screen node
     * survives a process restart and can be resumed after a cold boot.
     */
    suspendedRunStore?: 'auto' | 'memory';
}

/**
 * AutomationServicePlugin — Core engine plugin
 *
 * Responsibilities:
 * 1. init phase: Create engine instance, register as 'automation' service, and
 *    seed the platform's built-in node executors (logic / CRUD / screen-script /
 *    http_request) via {@link installBuiltinNodes}. Per ADR-0018, foundational
 *    capabilities are built into the core, not packaged as optional plugins.
 * 2. start phase: Trigger 'automation:ready' hook so third-party plugins can
 *    register additional node types, then pull flow definitions from the
 *    ObjectQL schema registry and register them with the engine.
 * 3. destroy phase: Clean up resources
 *
 * The engine's `registerNodeExecutor()` stays open so plugins extend the
 * node/action vocabulary at runtime — the marketplace-extensibility contract.
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

        // Register the sys_automation_run object so suspended-run state migrates
        // like other sys_* tables (ADR-0019). Best-effort: a host without the
        // manifest service still runs in-memory. Skipped when persistence is off.
        if ((this.options.suspendedRunStore ?? 'auto') !== 'memory') {
            try {
                ctx.getService<{ register(m: unknown): void }>('manifest').register({
                    id: 'com.objectstack.service-automation',
                    name: 'Automation Service',
                    version: '1.0.0',
                    type: 'plugin',
                    scope: 'system',
                    defaultDatasource: 'cloud',
                    namespace: 'sys',
                    objects: [SysAutomationRun],
                });
            } catch (err) {
                ctx.logger.warn(
                    `[Automation] manifest service unavailable; sys_automation_run not registered (suspended runs stay in-memory): ${(err as Error).message}`,
                );
            }
        }

        // Seed the platform's built-in node executors. A bare
        // `new AutomationServicePlugin()` is thus a self-contained automation
        // capability — no companion node-pack plugins required (ADR-0018).
        installBuiltinNodes(this.engine, ctx);

        if (this.options.debug) {
            ctx.hook('automation:beforeExecute', async (flowName: string) => {
                ctx.logger.debug(`[Automation] Before execute: ${flowName}`);
            });
        }

        ctx.logger.info('[Automation] Engine initialized');
    }

    async start(ctx: PluginContext): Promise<void> {
        console.warn('[Automation:start] entering start()');
        if (!this.engine) {
            console.warn('[Automation:start] engine missing, bailing');
            return;
        }

        // Trigger hook to notify engine is ready — other plugins can start registering nodes
        await ctx.trigger('automation:ready', this.engine);

        const nodeTypes = this.engine.getRegisteredNodeTypes();
        ctx.logger.info(
            `[Automation] Engine started with ${nodeTypes.length} node types: ${nodeTypes.join(', ') || '(none)'}`,
        );

        // Upgrade to durable suspended-run persistence when an ObjectQL engine is
        // present (ADR-0019). The engine was constructed in init() before
        // services were wired, so we attach the DB-backed store here. Without an
        // engine (or with `suspendedRunStore: 'memory'`) the in-memory default
        // stands — suspended runs simply don't survive a restart.
        if ((this.options.suspendedRunStore ?? 'auto') !== 'memory') {
            let dataEngine: SuspendedRunStoreEngine | null = null;
            try { dataEngine = ctx.getService<SuspendedRunStoreEngine>('objectql'); }
            catch { try { dataEngine = ctx.getService<SuspendedRunStoreEngine>('data'); } catch { /* none */ } }
            if (dataEngine && typeof dataEngine.find === 'function' && typeof dataEngine.insert === 'function') {
                this.engine.setSuspendedRunStore(new ObjectStoreSuspendedRunStore(dataEngine, ctx.logger));
                ctx.logger.info('[Automation] Suspended-run persistence enabled (sys_automation_run)');
            } else {
                ctx.logger.info('[Automation] No ObjectQL engine — suspended runs kept in-memory only');
            }
        }

        // Pull flow definitions from the ObjectQL schema registry. AppPlugin.init()
        // calls manifest.register(payload), which routes to ql.registerApp() and
        // stores each inline flow under type 'flow'. By the time start() runs,
        // every init() phase has completed, so the registry is fully populated.
        try {
            const ql = ctx.getService<{
                registry?: { listItems?: (type: string) => unknown[] };
            }>('objectql');
            if (!ql) {
                console.warn('[Automation] objectql service not found at start()');
            } else if (!ql.registry) {
                console.warn('[Automation] objectql.registry is undefined at start()');
            } else if (typeof ql.registry.listItems !== 'function') {
                console.warn('[Automation] objectql.registry.listItems is not a function');
            }
            const flows = ql?.registry?.listItems?.('flow') ?? [];
            console.warn(`[Automation] flow pull: registry returned ${flows.length} flow(s)`);
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
