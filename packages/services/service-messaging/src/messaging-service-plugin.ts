// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { randomUUID } from 'node:crypto';
import type { Plugin, PluginContext } from '@objectstack/core';
import type { IDataEngine } from '@objectstack/spec/contracts';
import { MessagingService } from './messaging-service.js';
import { createInboxChannel } from './inbox-channel.js';
import { SqlNotificationOutbox } from './sql-outbox.js';
import { NotificationDispatcher, type DispatchCluster } from './dispatcher.js';
import { InboxMessage, NotificationReceipt, NotificationDelivery } from './objects/index.js';

export interface MessagingServicePluginOptions {
    /**
     * Register the always-on `inbox` channel during init (default `true`).
     * Set `false` only for tests that want an empty registry.
     */
    registerInbox?: boolean;
    /**
     * Run the durable delivery outbox + dispatcher (ADR-0030 P1) when a data
     * engine is available (default `true`). When off (or no engine), `emit()`
     * fans out inline best-effort (P0 behavior).
     */
    reliableDelivery?: boolean;
    /** Outbox/dispatcher partition count (default 8). */
    partitionCount?: number;
    /** Dispatcher tick interval in ms (default 500). */
    dispatchIntervalMs?: number;
}

/**
 * MessagingServicePlugin — registers the `messaging` service (ADR-0012 /
 * ADR-0030).
 *
 * After bootstrap, `kernel.getService('messaging')` is a {@link MessagingService}
 * with the always-on `inbox` channel registered. The baseline `notify` flow
 * node dispatches through it; flows therefore stop being no-ops once this
 * plugin is installed. Other channels (email/webhook/push/IM) register
 * themselves on this same service.
 *
 * At `kernel:ready` (engine available) the plugin wires the reliable-delivery
 * path: a `SqlNotificationOutbox` over `sys_notification_delivery` plus a
 * `NotificationDispatcher` that drains it with retry/backoff/dead-letter.
 * `emit()` then enqueues durable deliveries instead of fanning out inline.
 *
 * @example
 * ```ts
 * const kernel = new ObjectKernel();
 * kernel.use(new AutomationServicePlugin()); // ships the `notify` node
 * kernel.use(new MessagingServicePlugin());  // backs it with delivery
 * await kernel.bootstrap();
 * ```
 */
export class MessagingServicePlugin implements Plugin {
    name = 'com.objectstack.service.messaging';
    version = '1.0.0';
    type = 'standard' as const;
    dependencies = ['com.objectstack.engine.objectql'];

    private readonly options: Required<MessagingServicePluginOptions>;
    private dispatcher?: NotificationDispatcher;

    constructor(options: MessagingServicePluginOptions = {}) {
        this.options = {
            registerInbox: true,
            reliableDelivery: true,
            partitionCount: 8,
            dispatchIntervalMs: 500,
            ...options,
        };
    }

    async init(ctx: PluginContext): Promise<void> {
        // Shared lazy data-engine resolver — used to persist the L2
        // `sys_notification` event in `emit()`, by the inbox channel to
        // materialize rows, and (at kernel:ready) to back the outbox. Resolved
        // lazily so it works regardless of plugin init order.
        const getData = (): IDataEngine | undefined => {
            try {
                return ctx.getService<IDataEngine>('data') ?? ctx.getService<IDataEngine>('objectql');
            } catch {
                return undefined;
            }
        };

        const service = new MessagingService({ logger: ctx.logger, getData });

        if (this.options.registerInbox) {
            service.registerChannel(createInboxChannel({ getData }));
        }

        ctx.registerService('messaging', service);

        // Register the messaging objects so their rows can be written.
        ctx.getService<{ register(m: unknown): void }>('manifest').register({
            id: 'com.objectstack.service.messaging',
            name: 'Messaging Service',
            version: '1.0.0',
            type: 'plugin',
            scope: 'system',
            objects: [InboxMessage, NotificationReceipt, NotificationDelivery],
        });

        // Reliable delivery (P1): wire the outbox + dispatcher once the engine
        // is resolvable. Until then `emit()` runs inline best-effort.
        if (this.options.reliableDelivery && typeof ctx.hook === 'function') {
            ctx.hook('kernel:ready', async () => {
                const engine = getData();
                if (!engine) {
                    ctx.logger.warn('[messaging] no data engine at kernel:ready — reliable delivery disabled (inline fan-out)');
                    return;
                }
                const outbox = new SqlNotificationOutbox(engine, { partitionCount: this.options.partitionCount });
                service.setOutbox(outbox);

                let cluster: DispatchCluster | undefined;
                try {
                    cluster = ctx.getService<DispatchCluster>('cluster');
                } catch {
                    cluster = undefined; // single-node fallback in the dispatcher
                }

                this.dispatcher = new NotificationDispatcher({
                    nodeId: `notify-${process.pid}-${randomUUID().slice(0, 8)}`,
                    outbox,
                    channels: service,
                    channelContext: { logger: ctx.logger },
                    cluster,
                    partitionCount: this.options.partitionCount,
                    intervalMs: this.options.dispatchIntervalMs,
                    logger: ctx.logger,
                });
                this.dispatcher.start();
                ctx.logger.info(
                    `[messaging] reliable delivery on (outbox + dispatcher, ${this.options.partitionCount} partitions${cluster ? ', clustered' : ', single-node'})`,
                );
            });
        }

        ctx.logger.info(
            `[messaging] service registered with channels: ${service.getRegisteredChannels().join(', ') || '(none)'}`,
        );
    }

    /** Stop the dispatcher loop on shutdown. */
    async stop(): Promise<void> {
        await this.dispatcher?.stop();
        this.dispatcher = undefined;
    }
}
