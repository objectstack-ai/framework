// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import type { DispatchCluster, DispatchLockHandle } from './dispatcher.js';
import { classifyAttempt, sendOnce, type FetchImpl } from './http-sender.js';
import type { HttpDelivery, IHttpOutbox } from './http-outbox.js';

/**
 * HttpDispatcher (ADR-0018 M3) — drains the generic outbound-HTTP outbox
 * (`sys_http_delivery`) and POSTs each row, retrying with backoff and
 * dead-lettering once the budget is exhausted.
 *
 * Structurally identical to `NotificationDispatcher` / `WebhookDispatcher`: an
 * interval loop walks `partitionCount` partitions, each guarded by a
 * per-partition cluster lock; within a held partition it claims a batch
 * (`pending → in_flight`), sends, and acks. Partition affinity is on the
 * delivery's `refId`, preserving in-order delivery per source anchor.
 *
 * At-least-once: if the POST succeeds but the ack write fails, the row reverts
 * to pending after the claim TTL and is re-posted. Receivers MUST be idempotent
 * on the `X-Objectstack-Delivery` (== row id) header.
 */

const SINGLE_NODE_CLUSTER: DispatchCluster = {
    lock: {
        async acquire() {
            return { release() {}, isHeld: () => true, renew() {} };
        },
    },
};

export interface HttpDispatcherLogger {
    warn: (msg: string, meta?: any) => void;
    info?: (msg: string, meta?: any) => void;
}

export interface HttpDispatcherOptions {
    /** Stable id identifying this dispatcher node. */
    nodeId: string;
    /** Outbox backend. */
    outbox: IHttpOutbox;
    /** Cross-node coordination. Defaults to a single-node always-grant lock. */
    cluster?: DispatchCluster;
    /** Partitions to split work across (must match the outbox's). Default 8. */
    partitionCount?: number;
    /** Max rows to claim from each partition per tick. Default 32. */
    batchSize?: number;
    /** Tick interval in ms. Default 500. */
    intervalMs?: number;
    /** Per-partition lock TTL. Default = 5 × intervalMs. */
    lockTtlMs?: number;
    /** Visibility timeout for claimed rows. Default = 2 × lockTtlMs. */
    claimTtlMs?: number;
    /** Override `globalThis.fetch` (tests). */
    fetchImpl?: FetchImpl;
    /** RNG override for the retry-jitter schedule (tests). */
    rng?: () => number;
    /** Injectable clock (ms) for deterministic tests. Defaults to Date.now. */
    now?: () => number;
    /** Logger callback (optional). */
    logger?: HttpDispatcherLogger;
    /** Hook fired after every attempt — observability hook. */
    onAttempt?: (delivery: HttpDelivery, success: boolean) => void;
}

export class HttpDispatcher {
    private readonly opts: Required<
        Omit<HttpDispatcherOptions, 'fetchImpl' | 'rng' | 'logger' | 'onAttempt' | 'cluster' | 'now'>
    > &
        Pick<HttpDispatcherOptions, 'fetchImpl' | 'rng' | 'logger' | 'onAttempt' | 'now'> & {
            cluster: DispatchCluster;
        };
    private timer: ReturnType<typeof setInterval> | undefined;
    private running = false;
    private inflightTick: Promise<void> | undefined;

    constructor(options: HttpDispatcherOptions) {
        const intervalMs = options.intervalMs ?? 500;
        const lockTtlMs = options.lockTtlMs ?? intervalMs * 5;
        this.opts = {
            nodeId: options.nodeId,
            outbox: options.outbox,
            cluster: options.cluster ?? SINGLE_NODE_CLUSTER,
            partitionCount: options.partitionCount ?? 8,
            batchSize: options.batchSize ?? 32,
            intervalMs,
            lockTtlMs,
            claimTtlMs: options.claimTtlMs ?? lockTtlMs * 2,
            fetchImpl: options.fetchImpl,
            rng: options.rng,
            now: options.now,
            logger: options.logger,
            onAttempt: options.onAttempt,
        };
    }

    /** Begin the periodic loop. Safe to call once; subsequent calls are no-ops. */
    start(): void {
        if (this.running) return;
        this.running = true;
        this.scheduleTick();
        this.timer = setInterval(() => this.scheduleTick(), this.opts.intervalMs);
        this.timer.unref?.();
    }

    /** Stop the loop and wait for the in-flight tick to drain. */
    async stop(): Promise<void> {
        if (!this.running) return;
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        if (this.inflightTick) {
            try {
                await this.inflightTick;
            } catch {
                /* swallow — already logged */
            }
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
                this.opts.logger?.warn?.('http-dispatcher: tick failed', {
                    nodeId: this.opts.nodeId,
                    error: (err as Error)?.message ?? String(err),
                });
            })
            .finally(() => {
                this.inflightTick = undefined;
            });
    }

    private async runTick(): Promise<void> {
        const partitionCount = this.opts.partitionCount;
        const offset = stableNodeOffset(this.opts.nodeId, partitionCount);
        for (let step = 0; step < partitionCount; step++) {
            const i = (offset + step) % partitionCount;
            await this.runPartition(i);
        }
    }

    private async runPartition(index: number): Promise<void> {
        const key = `http.dispatcher.partition.${index}`;
        const handle: DispatchLockHandle | null = await this.opts.cluster.lock.acquire(key, {
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
                now: this.opts.now?.(),
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

    private async processRow(row: HttpDelivery): Promise<void> {
        const fetchImpl = (this.opts.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl)) as
            | FetchImpl
            | undefined;
        if (!fetchImpl) {
            this.opts.logger?.warn?.('http-dispatcher: no fetch impl available', { rowId: row.id });
            await this.opts.outbox.ack(row.id, {
                success: false,
                error: 'no fetch implementation',
                durationMs: 0,
                dead: true,
            });
            return;
        }
        const outcome = await sendOnce(row, fetchImpl);
        const result = classifyAttempt(outcome, row.attempts, this.opts.now?.() ?? Date.now(), this.opts.rng);
        await this.opts.outbox.ack(row.id, result);
        this.opts.onAttempt?.(row, result.success);
    }
}

/** Spread starting partition per node so nodes don't serialise on partition 0. */
function stableNodeOffset(nodeId: string, partitionCount: number): number {
    let h = 0;
    for (let i = 0; i < nodeId.length; i++) {
        h = (h * 31 + nodeId.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % partitionCount;
}
