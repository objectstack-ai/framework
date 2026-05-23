// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import type {
    IClusterService,
    IDataEngine,
    IRealtimeService,
} from '@objectstack/spec/contracts';
import { SysWebhook } from '@objectstack/platform-objects/integration';
import { AutoEnqueuer, type AutoEnqueuerOptions } from './auto-enqueuer.js';
import { WebhookDispatcher, type DispatcherOptions } from './dispatcher.js';
import { MemoryWebhookOutbox } from './memory-outbox.js';
import type { IWebhookOutbox } from './outbox.js';
import {
    DeliveryRetentionSweeper,
    type DeliveryRetentionOptions,
} from './retention.js';
import { SysWebhookDelivery } from './sys-webhook-delivery.object.js';

export interface WebhookOutboxPluginOptions
    extends Partial<Omit<DispatcherOptions, 'cluster' | 'outbox' | 'nodeId'>> {
    /**
     * Override the outbox backend. If omitted a fresh `MemoryWebhookOutbox`
     * is used — fine for local development, **not for production**: each
     * node will see only its own rows.
     *
     * Pass a factory if you need the kernel-resolved `IDataEngine`:
     *
     * ```ts
     * outbox: (ctx) => new SqlWebhookOutbox(
     *   ctx.getService('objectql'), { partitionCount: 8 },
     * ),
     * ```
     */
    outbox?: IWebhookOutbox | ((ctx: PluginContext) => IWebhookOutbox);

    /**
     * Stable node id. If omitted, uses `process.env.OBJECTSTACK_NODE_ID`
     * or a random UUID generated at plugin init.
     */
    nodeId?: string;

    /**
     * If `false`, the plugin registers the outbox/dispatcher services but
     * does NOT auto-start the loop — useful for tests that want to step
     * the dispatcher manually via `dispatcher.tick()`.
     *
     * Default: true.
     */
    autoStart?: boolean;

    /**
     * Auto-enqueue config. When enabled (default `true` if the realtime
     * + data engine services are available), the plugin subscribes to
     * `data.record.*` events emitted by the engine and automatically
     * enqueues a delivery row for every matching `sys_webhook` row.
     *
     * Set `false` to disable and only use the imperative
     * `outbox.enqueue()` API.
     */
    autoEnqueue?: boolean | AutoEnqueuerOptions;

    /**
     * Retention sweep config. When enabled (default `true` if a SQL
     * outbox is in use), a periodic timer prunes old `success` and
     * `dead` rows from `sys_webhook_delivery`.
     *
     * Set `false` to disable (e.g. when using `MemoryWebhookOutbox`).
     */
    retention?: boolean | DeliveryRetentionOptions;
}

/**
 * Wires a persistent, cluster-aware webhook outbox into the kernel.
 *
 * Registered services:
 *   - `webhook.outbox`     → `IWebhookOutbox` (enqueue / claim / ack / list)
 *   - `webhook.dispatcher` → `WebhookDispatcher` (manual `tick()` if needed)
 *   - `webhook.autoEnqueuer` → `AutoEnqueuer` when auto-enqueue is on
 *   - `webhook.retention`    → `DeliveryRetentionSweeper` when retention is on
 *
 * End-to-end flow once auto-enqueue is enabled:
 *
 *   engine.insert('contact', {...})
 *     → engine publishes data.record.created via IRealtimeService
 *     → AutoEnqueuer matches active sys_webhook rows in O(1)
 *     → outbox.enqueue() runs fire-and-forget (not on the write path)
 *     → dispatcher claims and POSTs (cluster-coordinated)
 *
 * **Cluster requirement** — this plugin depends on the cluster service
 * (`ClusterServicePlugin`). With the default `memory` driver the
 * dispatcher works correctly inside a single process; with a real driver
 * (`@objectstack/service-cluster-redis`) it correctly coordinates work
 * across nodes.
 */
export class WebhookOutboxPlugin implements Plugin {
    name = 'com.objectstack.plugin-webhook-outbox';
    version = '1.1.0';
    type = 'standard' as const;
    dependencies = ['com.objectstack.service.cluster'];

    private dispatcher: WebhookDispatcher | undefined;
    private autoEnqueuer: AutoEnqueuer | undefined;
    private retention: DeliveryRetentionSweeper | undefined;
    private outboxInstance: IWebhookOutbox | undefined;

    constructor(private readonly options: WebhookOutboxPluginOptions = {}) {}

    async init(ctx: PluginContext): Promise<void> {
        const cluster = ctx.getService<IClusterService>('cluster');
        if (!cluster) {
            throw new Error(
                'WebhookOutboxPlugin: required service "cluster" not found — register ClusterServicePlugin first',
            );
        }

        // Register the schemas this plugin owns at runtime. `sys_webhook`
        // (config) lives in @objectstack/platform-objects but no other
        // plugin claims it — the webhook plugin is the natural owner
        // since it's the consumer of those rows. `sys_webhook_delivery`
        // (telemetry) is plugin-private. Registering them here means a
        // stack just needs `plugins: [new WebhookOutboxPlugin(...)]`
        // and both objects auto-appear in REST/Studio/Setup nav.
        const manifest = ctx.getService<{ register(m: any): void }>('manifest');
        if (manifest && typeof manifest.register === 'function') {
            manifest.register({
                id: 'com.objectstack.plugin-webhook-outbox.schema',
                namespace: 'sys',
                version: this.version,
                type: 'plugin',
                scope: 'system',
                name: 'Webhook Outbox Schemas',
                description:
                    'Registers sys_webhook (configuration) and sys_webhook_delivery (durable outbox telemetry).',
                objects: [SysWebhook, SysWebhookDelivery],
            });
        } else {
            ctx.logger.warn?.(
                '[webhook-outbox] manifest service unavailable — sys_webhook / sys_webhook_delivery will NOT appear in REST or Studio nav. Register MetadataService before WebhookOutboxPlugin.',
            );
        }

        const outbox = this.resolveOutbox(ctx);
        this.outboxInstance = outbox;
        const nodeId =
            this.options.nodeId ??
            process.env.OBJECTSTACK_NODE_ID ??
            `node-${Math.random().toString(36).slice(2, 10)}`;

        const dispatcher = new WebhookDispatcher({
            nodeId,
            cluster,
            outbox,
            partitionCount: this.options.partitionCount,
            batchSize: this.options.batchSize,
            intervalMs: this.options.intervalMs,
            lockTtlMs: this.options.lockTtlMs,
            claimTtlMs: this.options.claimTtlMs,
            fetchImpl: this.options.fetchImpl,
            onAttempt: this.options.onAttempt,
            rng: this.options.rng,
            logger: ctx.logger,
        });
        this.dispatcher = dispatcher;

        ctx.registerService('webhook.outbox', outbox);
        ctx.registerService('webhook.dispatcher', dispatcher);

        if (this.options.autoStart !== false) {
            dispatcher.start();
        }

        // Loud warning when running with the in-memory outbox in production —
        // it loses data on restart and never shares rows across nodes.
        const usingMemoryOutbox = outbox instanceof MemoryWebhookOutbox;
        if (usingMemoryOutbox && process.env.NODE_ENV === 'production') {
            ctx.logger.warn?.(
                '[webhook-outbox] MemoryWebhookOutbox in production — webhook deliveries WILL be lost on process exit. Pass `outbox: (ctx) => new SqlWebhookOutbox(ctx.getService("objectql"), { partitionCount: 8 })` from `@objectstack/plugin-webhooks/sql`.',
            );
        }

        // Auto-enqueue + retention need the kernel to be fully ready
        // before ObjectQL / Realtime services are resolvable.
        const autoEnqueueOpt = this.options.autoEnqueue ?? true;
        const retentionOpt = this.options.retention ?? true;

        const needsReadyHook = autoEnqueueOpt !== false || retentionOpt !== false;
        if (needsReadyHook && typeof (ctx as any).hook === 'function') {
            (ctx as any).hook('kernel:ready', async () => {
                await this.bootAutoEnqueue(ctx, autoEnqueueOpt);
                this.bootRetention(ctx, retentionOpt);
            });
        }

        ctx.logger.info?.('[webhook-outbox] initialised', {
            nodeId,
            partitions: this.options.partitionCount ?? 8,
            interval: this.options.intervalMs ?? 250,
            autoEnqueue: autoEnqueueOpt !== false,
            retention: retentionOpt !== false,
        });
    }

    async dispose(): Promise<void> {
        await this.autoEnqueuer?.stop();
        this.retention?.stop();
        await this.dispatcher?.stop();
    }

    private resolveOutbox(ctx: PluginContext): IWebhookOutbox {
        const opt = this.options.outbox;
        if (!opt) return new MemoryWebhookOutbox();
        if (typeof opt === 'function') return (opt as (c: PluginContext) => IWebhookOutbox)(ctx);
        return opt;
    }

    private async bootAutoEnqueue(
        ctx: PluginContext,
        opt: boolean | AutoEnqueuerOptions,
    ): Promise<void> {
        if (opt === false) return;
        const engine = this.tryGetService<IDataEngine>(ctx, ['objectql', 'data']);
        const realtime = this.tryGetService<IRealtimeService>(ctx, ['realtime']);
        if (!engine || !realtime) {
            ctx.logger.warn?.(
                '[webhook-auto-enqueuer] disabled — ObjectQL or Realtime service not available',
                { hasEngine: !!engine, hasRealtime: !!realtime },
            );
            return;
        }
        if (!this.outboxInstance) return;

        const enqOpts = (typeof opt === 'object' ? opt : {}) as AutoEnqueuerOptions;
        this.autoEnqueuer = new AutoEnqueuer(
            engine,
            realtime,
            this.outboxInstance,
            { ...enqOpts, logger: ctx.logger },
        );
        await this.autoEnqueuer.start();
        ctx.registerService('webhook.autoEnqueuer', this.autoEnqueuer);
        ctx.logger.info?.('[webhook-auto-enqueuer] started');
    }

    private bootRetention(
        ctx: PluginContext,
        opt: boolean | DeliveryRetentionOptions,
    ): void {
        if (opt === false) return;
        // Only meaningful for SQL outbox — Memory has its own (process-lifetime) GC.
        if (this.outboxInstance instanceof MemoryWebhookOutbox) return;
        const engine = this.tryGetService<IDataEngine>(ctx, ['objectql', 'data']);
        if (!engine) {
            ctx.logger.warn?.(
                '[webhook-retention] disabled — ObjectQL service not available',
            );
            return;
        }
        const retOpts = (typeof opt === 'object' ? opt : {}) as DeliveryRetentionOptions;
        this.retention = new DeliveryRetentionSweeper(engine, {
            ...retOpts,
            logger: ctx.logger,
        });
        this.retention.start();
        ctx.registerService('webhook.retention', this.retention);
        ctx.logger.info?.('[webhook-retention] sweeper started');
    }

    private tryGetService<T>(ctx: PluginContext, names: string[]): T | undefined {
        for (const n of names) {
            try {
                const svc = ctx.getService<T>(n);
                if (svc) return svc;
            } catch {
                // fall through
            }
        }
        return undefined;
    }
}
