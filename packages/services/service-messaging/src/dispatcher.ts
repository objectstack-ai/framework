// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { MessagingChannel, MessagingChannelContext, Notification, SendResult } from './channel.js';
import type { INotificationOutbox, NotificationDeliveryRecord } from './outbox.js';
import { classifyDeliveryAttempt } from './backoff.js';

/** Minimal channel-registry surface the dispatcher needs (MessagingService satisfies it). */
export interface ChannelRegistry {
    getChannel(id: string): MessagingChannel | undefined;
}

/** A held lock; `release()` frees it, `isHeld()`/`renew()` mirror the cluster API. */
export interface DispatchLockHandle {
    release(): Promise<void> | void;
    isHeld?(): boolean;
    renew?(ttlMs: number): Promise<void> | void;
}

/** Just the slice of `IClusterService` the dispatcher uses. */
export interface DispatchCluster {
    lock: {
        acquire(key: string, opts: { ttlMs: number; waitMs: number }): Promise<DispatchLockHandle | null>;
    };
}

/**
 * Single-node fallback lock — always grants. Used when no cluster service is
 * registered, so the dispatcher runs correctly (just without cross-node
 * coordination). The per-partition serialization a single process needs is
 * already provided by the `inflightTick` guard + the outbox's atomic claim.
 */
const SINGLE_NODE_CLUSTER: DispatchCluster = {
    lock: {
        async acquire() {
            return { release() {}, isHeld: () => true, renew() {} };
        },
    },
};

export interface NotificationDispatcherLogger {
    warn: (msg: string, meta?: any) => void;
    info?: (msg: string, meta?: any) => void;
}

export interface NotificationDispatcherOptions {
    nodeId: string;
    outbox: INotificationOutbox;
    channels: ChannelRegistry;
    /** Context handed to each channel's `send()` (logger). */
    channelContext: MessagingChannelContext;
    /** Cross-node coordination. Defaults to a single-node always-grant lock. */
    cluster?: DispatchCluster;
    partitionCount?: number;
    batchSize?: number;
    intervalMs?: number;
    lockTtlMs?: number;
    claimTtlMs?: number;
    rng?: () => number;
    /** Injectable clock (ms) for deterministic tests. Defaults to Date.now. */
    now?: () => number;
    logger?: NotificationDispatcherLogger;
    /** Observability hook fired after every attempt. */
    onAttempt?: (delivery: NotificationDeliveryRecord, success: boolean) => void;
}

/**
 * NotificationDispatcher (ADR-0030 P1) — drains the `sys_notification_delivery`
 * outbox and sends each row through its channel, retrying with backoff and
 * dead-lettering once the budget is exhausted. Structurally mirrors
 * `WebhookDispatcher`: an interval loop walks `partitionCount` partitions, each
 * guarded by a per-partition cluster lock; within a held partition it claims a
 * batch (`pending → in_flight`), sends, and acks.
 *
 * At-least-once: if a channel send succeeds but the ack write fails, the row
 * reverts to pending after the claim TTL and is re-sent — the inbox channel's
 * receipt write is idempotent-friendly, and downstream channels should be too.
 */
export class NotificationDispatcher {
    private readonly opts: Required<
        Omit<NotificationDispatcherOptions, 'rng' | 'logger' | 'onAttempt' | 'cluster' | 'now'>
    > &
        Pick<NotificationDispatcherOptions, 'rng' | 'logger' | 'onAttempt' | 'now'> & { cluster: DispatchCluster };
    private timer: ReturnType<typeof setInterval> | undefined;
    private running = false;
    private inflightTick: Promise<void> | undefined;

    constructor(options: NotificationDispatcherOptions) {
        const intervalMs = options.intervalMs ?? 500;
        const lockTtlMs = options.lockTtlMs ?? intervalMs * 5;
        this.opts = {
            nodeId: options.nodeId,
            outbox: options.outbox,
            channels: options.channels,
            channelContext: options.channelContext,
            cluster: options.cluster ?? SINGLE_NODE_CLUSTER,
            partitionCount: options.partitionCount ?? 8,
            batchSize: options.batchSize ?? 32,
            intervalMs,
            lockTtlMs,
            claimTtlMs: options.claimTtlMs ?? lockTtlMs * 2,
            rng: options.rng,
            now: options.now,
            logger: options.logger,
            onAttempt: options.onAttempt,
        };
    }

    /** Begin the periodic loop. Idempotent. */
    start(): void {
        if (this.running) return;
        this.running = true;
        this.scheduleTick();
        this.timer = setInterval(() => this.scheduleTick(), this.opts.intervalMs);
        // Don't keep the event loop alive solely for the dispatcher.
        (this.timer as { unref?: () => void })?.unref?.();
    }

    /** Stop the loop and drain the in-flight tick. */
    async stop(): Promise<void> {
        if (!this.running) return;
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        if (this.inflightTick) {
            try { await this.inflightTick; } catch { /* already logged */ }
        }
    }

    /** Run one full tick (all partitions). Exposed for deterministic tests. */
    async tick(): Promise<void> {
        await this.runTick();
    }

    private scheduleTick(): void {
        if (this.inflightTick) return;
        this.inflightTick = this.runTick()
            .catch((err) => {
                this.opts.logger?.warn?.('notification-dispatcher: tick failed', {
                    nodeId: this.opts.nodeId,
                    error: (err as Error)?.message ?? String(err),
                });
            })
            .finally(() => { this.inflightTick = undefined; });
    }

    private async runTick(): Promise<void> {
        const count = this.opts.partitionCount;
        const offset = stableNodeOffset(this.opts.nodeId, count);
        for (let step = 0; step < count; step++) {
            await this.runPartition((offset + step) % count);
        }
    }

    private async runPartition(index: number): Promise<void> {
        const handle = await this.opts.cluster.lock.acquire(`notify.dispatcher.partition.${index}`, {
            ttlMs: this.opts.lockTtlMs,
            waitMs: 0,
        });
        if (!handle) return;
        try {
            const claimed = await this.opts.outbox.claim({
                nodeId: this.opts.nodeId,
                limit: this.opts.batchSize,
                partition: { index, count: this.opts.partitionCount },
                claimTtlMs: this.opts.claimTtlMs,
            });
            if (claimed.length === 0) return;
            await handle.renew?.(this.opts.lockTtlMs);
            for (const row of claimed) {
                if (handle.isHeld && !handle.isHeld()) break;
                await this.processRow(row);
            }
        } finally {
            await handle.release();
        }
    }

    private async processRow(row: NotificationDeliveryRecord): Promise<void> {
        const channel = this.opts.channels.getChannel(row.channel);
        if (!channel) {
            // No transport for this channel → terminal, observable on the row.
            await this.opts.outbox.ack(row.id, {
                success: false,
                error: `channel '${row.channel}' not registered`,
                dead: true,
            });
            this.opts.onAttempt?.(row, false);
            return;
        }

        const p = row.payload ?? {};
        const notification: Notification = {
            notificationId: row.notificationId,
            organizationId: row.organizationId,
            topic: row.topic,
            title: typeof p.title === 'string' ? p.title : row.topic ?? '',
            body: typeof p.body === 'string' ? p.body : '',
            severity: (p.severity as Notification['severity']) ?? 'info',
            recipients: [row.recipientId],
            channels: [row.channel],
            actionUrl: typeof p.actionUrl === 'string' ? p.actionUrl : undefined,
            payload: p,
        };

        let result: SendResult;
        try {
            result = await channel.send(this.opts.channelContext, {
                notification,
                channel: row.channel,
                recipient: row.recipientId,
            });
        } catch (err) {
            result = { ok: false, error: (err as Error)?.message ?? String(err) };
        }

        const errorClass = !result.ok && channel.classifyError ? channel.classifyError(result.error) : undefined;
        const now = this.opts.now?.() ?? Date.now();
        const ack = classifyDeliveryAttempt(result, errorClass, row.attempts, now, this.opts.rng);
        await this.opts.outbox.ack(row.id, ack);
        this.opts.onAttempt?.(row, result.ok);
    }
}

/** Spread the starting partition per node so contention rotates fairly. */
function stableNodeOffset(nodeId: string, partitionCount: number): number {
    let h = 0;
    for (let i = 0; i < nodeId.length; i++) h = (h * 31 + nodeId.charCodeAt(i)) | 0;
    return Math.abs(h) % partitionCount;
}
