// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import type { IDataEngine } from '@objectstack/spec/contracts';
import { SYS_WEBHOOK_DELIVERY } from './schema.js';

interface OptionalLogger {
    info?(msg: string, meta?: unknown): void;
    warn?(msg: string, meta?: unknown): void;
    debug?(msg: string, meta?: unknown): void;
}

export interface DeliveryRetentionOptions {
    /**
     * Object name backing the outbox. Defaults to `sys_webhook_delivery`.
     */
    objectName?: string;

    /**
     * How long to keep `success` rows. Default 7 days. Set to `0` to
     * disable the success sweep (keep forever — not recommended in
     * production).
     */
    successTtlMs?: number;

    /**
     * How long to keep `dead` rows. Default 30 days. Set to `0` to
     * keep forever.
     */
    deadTtlMs?: number;

    /**
     * How often to run the sweep. Default 1h.
     */
    sweepIntervalMs?: number;

    logger?: OptionalLogger;
}

const DEFAULTS = {
    successTtlMs: 7 * 24 * 60 * 60 * 1000,
    deadTtlMs: 30 * 24 * 60 * 60 * 1000,
    sweepIntervalMs: 60 * 60 * 1000,
};

/**
 * Periodically prunes `sys_webhook_delivery` rows so the table doesn't
 * grow unbounded.
 *
 * Without this every successful POST would leave a permanent row. At
 * even moderate scale (10 events/s × 3 webhooks = 30 rows/s = ~2.6M
 * rows/day) the table becomes a problem within a week.
 *
 * Retention defaults mirror Stripe/GitHub:
 *   - `success`: 7 days
 *   - `dead`:   30 days (kept longer for audit & manual re-delivery)
 *   - `pending`/`in_flight`/`failed`: never auto-pruned (they're
 *     either live work or signal something needs human attention)
 *
 * Runs on whichever node holds the sweeper interval — it doesn't need
 * a cluster lock because DELETE WHERE created_at < threshold is
 * idempotent; multiple nodes running concurrently is wasteful but
 * safe.
 */
export class DeliveryRetentionSweeper {
    private readonly objectName: string;
    private readonly successTtlMs: number;
    private readonly deadTtlMs: number;
    private readonly sweepIntervalMs: number;
    private readonly logger: OptionalLogger;
    private timer: ReturnType<typeof setInterval> | undefined;
    private running = false;

    constructor(
        private readonly engine: IDataEngine,
        opts: DeliveryRetentionOptions = {},
    ) {
        this.objectName = opts.objectName ?? SYS_WEBHOOK_DELIVERY;
        this.successTtlMs = opts.successTtlMs ?? DEFAULTS.successTtlMs;
        this.deadTtlMs = opts.deadTtlMs ?? DEFAULTS.deadTtlMs;
        this.sweepIntervalMs = opts.sweepIntervalMs ?? DEFAULTS.sweepIntervalMs;
        this.logger = opts.logger ?? {};
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        // First sweep deferred by one interval — let the system boot first.
        this.timer = setInterval(() => {
            this.sweep().catch((err) =>
                this.logger.warn?.('[webhook-retention] sweep failed', err),
            );
        }, this.sweepIntervalMs);
        this.timer.unref?.();
    }

    stop(): void {
        if (!this.running) return;
        this.running = false;
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
    }

    /** Run one sweep immediately. Returns the number of rows deleted. */
    async sweep(now: number = Date.now()): Promise<{ success: number; dead: number }> {
        let successDeleted = 0;
        let deadDeleted = 0;

        if (this.successTtlMs > 0) {
            try {
                const res = await this.engine.delete(this.objectName, {
                    where: {
                        status: 'success',
                        updated_at: { $lt: now - this.successTtlMs },
                    },
                });
                successDeleted = res?.affected ?? 0;
            } catch (err) {
                this.logger.warn?.('[webhook-retention] success sweep failed', err);
            }
        }

        if (this.deadTtlMs > 0) {
            try {
                const res = await this.engine.delete(this.objectName, {
                    where: {
                        status: 'dead',
                        updated_at: { $lt: now - this.deadTtlMs },
                    },
                });
                deadDeleted = res?.affected ?? 0;
            } catch (err) {
                this.logger.warn?.('[webhook-retention] dead sweep failed', err);
            }
        }

        if (successDeleted + deadDeleted > 0) {
            this.logger.info?.('[webhook-retention] sweep complete', {
                success: successDeleted,
                dead: deadDeleted,
            });
        }
        return { success: successDeleted, dead: deadDeleted };
    }
}
