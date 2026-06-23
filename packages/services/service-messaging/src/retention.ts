// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IDataEngine } from '@objectstack/spec/contracts';
import { NOTIFICATION_EVENT_OBJECT } from './messaging-service.js';
import { DELIVERY_OBJECT } from './sql-outbox.js';
import { INBOX_OBJECT, RECEIPT_OBJECT } from './inbox-channel.js';

/**
 * Default retention window for the notification pipeline, in days. Default-on as
 * of GA (launch-readiness.md P1-2): 90 days keeps a quarter of in-app history
 * for the bell / audit while bounding `sys_notification` (+ delivery / inbox /
 * receipt) growth. Operators override via `MessagingServicePlugin` options;
 * `0` disables pruning entirely.
 */
export const DEFAULT_NOTIFICATION_RETENTION_DAYS = 90;

/** Minimal logger surface (matches the channel/service context). */
interface RetentionLogger {
    info(msg: string): void;
    warn(msg: string): void;
}

/**
 * One object the sweeper prunes, plus the field that carries its age. Every
 * target's `created_at` is a builtin audit column — a native `TIMESTAMP` on
 * Postgres/MySQL — so the cutoff is always an ISO-8601 string. (An earlier
 * version passed an epoch-ms number for the delivery outbox; that compared a
 * bigint to a timestamp column and Postgres rejected it with "date/time field
 * value out of range". SQLite's lenient column affinity hid the bug.) The
 * driver coerces the ISO comparand to the column's storage form per dialect.
 */
export interface RetentionTarget {
    readonly object: string;
    readonly tsField: string;
}

/**
 * Default sweep set, ordered leaf-first (materializations/receipts/deliveries
 * before the event) so the log reads top-down even though there are no enforced
 * FKs. A notification ages out **wholesale** — event + delivery + materialization
 * + receipt past the cutoff are all removed — keeping the model consistent (no
 * dangling `notification_id`) and the bell (which only shows recent rows)
 * unaffected.
 */
export const DEFAULT_RETENTION_TARGETS: readonly RetentionTarget[] = [
    { object: RECEIPT_OBJECT, tsField: 'created_at' },
    { object: INBOX_OBJECT, tsField: 'created_at' },
    { object: DELIVERY_OBJECT, tsField: 'created_at' },
    { object: NOTIFICATION_EVENT_OBJECT, tsField: 'created_at' },
];

export interface NotificationRetentionOptions {
    /** Resolve the data engine; `undefined` ⇒ prune is a no-op. */
    getData(): IDataEngine | undefined;
    logger: RetentionLogger;
    /** Override the swept objects (tests / custom deployments). */
    targets?: readonly RetentionTarget[];
    /** Clock injection for deterministic tests. Defaults to `Date.now()`. */
    now?(): number;
}

/** Per-object prune outcome. `deleted` is `undefined` when the driver doesn't report a count. */
export interface PruneOutcome {
    object: string;
    deleted?: number;
    error?: string;
}

/**
 * Retention sweeper for the notification pipeline (ADR-0030 hardening).
 *
 * Every `emit()` writes a `sys_notification` event row (plus delivery /
 * materialization / receipt rows), so a high-frequency periodic flow grows the
 * tables unbounded. {@link prune} deletes everything older than a cutoff across
 * all {@link RetentionTarget}s in one bulk `delete` per object, under a system
 * context (cross-tenant: retention is an operator policy). Each target is
 * isolated — one object's failure is logged and the sweep continues.
 *
 * Retention is **opt-in**: the plugin runs this only when `retentionDays` is
 * configured. The mechanism lives here so it's testable in isolation.
 */
export class NotificationRetention {
    private readonly now: () => number;
    private readonly targets: readonly RetentionTarget[];

    constructor(private readonly opts: NotificationRetentionOptions) {
        this.now = opts.now ?? (() => Date.now());
        this.targets = opts.targets ?? DEFAULT_RETENTION_TARGETS;
    }

    /**
     * Delete pipeline rows older than `retentionDays`. Returns one outcome per
     * swept object. No-op (empty result) when no data engine is available or
     * `retentionDays` is not a positive number.
     */
    async prune(retentionDays: number): Promise<PruneOutcome[]> {
        const data = this.opts.getData();
        if (!data) {
            this.opts.logger.warn('[messaging] retention: no data engine; prune skipped');
            return [];
        }
        if (!(retentionDays > 0)) {
            this.opts.logger.warn(`[messaging] retention: invalid retentionDays=${retentionDays}; prune skipped`);
            return [];
        }

        const cutoffIso = new Date(this.now() - retentionDays * 86_400_000).toISOString();
        const outcomes: PruneOutcome[] = [];

        for (const t of this.targets) {
            try {
                const res = await data.delete(t.object, {
                    // ISO-8601 cutoff for every target: `created_at` is a native
                    // timestamp column, which rejects a bare epoch-ms number on
                    // Postgres. The driver coerces this per dialect on the way down.
                    where: { [t.tsField]: { $lt: cutoffIso } },
                    multi: true,
                    // System context: retention is an operator policy that spans
                    // tenants, so it must not be scoped by the caller's RLS.
                    context: { isSystem: true },
                } as any);
                const deleted = countDeleted(res);
                outcomes.push({ object: t.object, deleted });
                if (deleted === undefined || deleted > 0) {
                    this.opts.logger.info(
                        `[messaging] retention: pruned ${deleted ?? '?'} ${t.object} rows older than ${cutoffIso}`,
                    );
                }
            } catch (err) {
                const msg = (err as Error)?.message ?? String(err);
                this.opts.logger.warn(`[messaging] retention: prune of ${t.object} failed (${msg}); continuing`);
                outcomes.push({ object: t.object, error: msg });
            }
        }
        return outcomes;
    }
}

/** Best-effort row-count extraction from a driver's delete result. */
function countDeleted(res: unknown): number | undefined {
    if (typeof res === 'number') return res;
    if (Array.isArray(res)) return res.length;
    if (res && typeof res === 'object') {
        const r = res as Record<string, unknown>;
        for (const k of ['deletedCount', 'deleted', 'count', 'affected', 'affectedRows']) {
            if (typeof r[k] === 'number') return r[k] as number;
        }
    }
    return undefined;
}
