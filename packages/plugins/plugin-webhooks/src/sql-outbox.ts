// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { randomUUID } from 'node:crypto';
import type { IDataEngine } from '@objectstack/spec/contracts';
import type {
    AckResult,
    ClaimOptions,
    DeliveryStatus,
    EnqueueInput,
    IWebhookOutbox,
    WebhookDelivery,
} from './outbox.js';
import { RedeliverError } from './outbox.js';
import { hashPartition } from './partition.js';
import { SYS_WEBHOOK_DELIVERY } from './schema.js';

export interface SqlWebhookOutboxOptions {
    /**
     * Total partition count — MUST match the dispatcher's `partitionCount`.
     * Used at enqueue time to precompute `partition_key`.
     */
    partitionCount: number;
    /**
     * Object name to read/write. Defaults to `sys_webhook_delivery`. Override
     * only if you've registered the schema under a different name.
     */
    objectName?: string;
}

interface DeliveryRow {
    id: string;
    webhook_id: string;
    event_id: string;
    event_type: string;
    url: string;
    method?: string | null;
    headers_json?: string | null;
    secret?: string | null;
    timeout_ms?: number | null;
    payload_json: string;
    partition_key: number;
    status: DeliveryStatus;
    attempts: number;
    claimed_by?: string | null;
    claimed_at?: number | null;
    next_retry_at?: number | null;
    last_attempted_at?: number | null;
    response_code?: number | null;
    response_body?: string | null;
    error?: string | null;
    created_at: number;
    updated_at: number;
}

/**
 * Durable `IWebhookOutbox` backed by ObjectQL — the production storage
 * impl. Works against any registered driver (SQL, Turso, Mongo, in-memory)
 * because everything goes through the driver-agnostic `IDataEngine` API.
 *
 * **Why no `FOR UPDATE SKIP LOCKED`?** ObjectQL is driver-agnostic — that
 * SQL feature is Postgres-only. We get equivalent safety from two layers:
 *
 *   1. `cluster.lock` held per partition by the dispatcher (the primary
 *      mutex). One node owns one partition at a time → no two claimers.
 *   2. Atomic `UPDATE WHERE status='pending'` (the backup). Even if two
 *      claimers slip through (e.g. admin reschedule + dispatcher), only
 *      the first UPDATE matches each row.
 *
 * **Why precompute `partition_key` on enqueue?** ObjectQL has no
 * cross-driver `hash()` function in WHERE clauses. Storing the partition
 * as a column makes the claim query a plain indexed lookup.
 *
 * **Dedup race**: SELECT-then-INSERT has a tiny window where two
 * concurrent producers both miss the SELECT and both INSERT. The unique
 * index `(event_id, webhook_id)` on the table catches it — the second
 * INSERT errors, the producer ignores it. Receivers MUST be idempotent
 * on the `X-Objectstack-Delivery` header anyway.
 */
export class SqlWebhookOutbox implements IWebhookOutbox {
    private readonly objectName: string;
    private readonly partitionCount: number;

    constructor(
        private readonly engine: IDataEngine,
        opts: SqlWebhookOutboxOptions,
    ) {
        if (opts.partitionCount <= 0) {
            throw new Error('SqlWebhookOutbox: partitionCount must be > 0');
        }
        this.objectName = opts.objectName ?? SYS_WEBHOOK_DELIVERY;
        this.partitionCount = opts.partitionCount;
    }

    async enqueue(input: EnqueueInput): Promise<string> {
        // Cheap pre-check to absorb most duplicates without hitting the
        // unique-index error path. Race window with the INSERT below is
        // intentional and documented.
        const existing = await this.engine.findOne(this.objectName, {
            where: { event_id: input.eventId, webhook_id: input.webhookId },
            fields: ['id'],
        });
        if (existing?.id) return existing.id as string;

        const id = randomUUID();
        const now = Date.now();
        const row: Omit<DeliveryRow, 'response_body' | 'error'> = {
            id,
            webhook_id: input.webhookId,
            event_id: input.eventId,
            event_type: input.eventType,
            url: input.url,
            method: input.method ?? 'POST',
            headers_json: input.headers ? JSON.stringify(input.headers) : undefined,
            secret: input.secret,
            timeout_ms: input.timeoutMs,
            payload_json: JSON.stringify(input.payload ?? null),
            partition_key: hashPartition(input.webhookId, this.partitionCount),
            status: 'pending',
            attempts: 0,
            created_at: now,
            updated_at: now,
        };
        try {
            await this.engine.insert(this.objectName, row);
            return id;
        } catch (err) {
            // Unique-index collision (dedup race) → look up the winner and
            // return its id. Any other error propagates.
            const winner = await this.engine.findOne(this.objectName, {
                where: { event_id: input.eventId, webhook_id: input.webhookId },
                fields: ['id'],
            });
            if (winner?.id) return winner.id as string;
            throw err;
        }
    }

    async claim(opts: ClaimOptions): Promise<WebhookDelivery[]> {
        const now = opts.now ?? Date.now();

        // 1. Reap stale in_flight rows — visibility-timeout recovery.
        await this.engine.update(
            this.objectName,
            { status: 'pending', claimed_by: null, claimed_at: null, updated_at: now },
            {
                where: {
                    status: 'in_flight',
                    claimed_at: { $lt: now - opts.claimTtlMs },
                },
                multi: true,
            },
        );

        // 2. Pick candidate ids.
        const partitionFilter = opts.partition
            ? { partition_key: opts.partition.index }
            : {};
        const candidates = await this.engine.find(this.objectName, {
            where: {
                status: 'pending',
                ...partitionFilter,
                // next_retry_at <= now OR null
                $or: [
                    { next_retry_at: null },
                    { next_retry_at: { $lte: now } },
                ],
            },
            fields: ['id'],
            // No orderBy for portability — drivers handle the natural insert order.
            limit: opts.limit,
        });
        if (candidates.length === 0) return [];

        const ids = (candidates as Array<{ id: string }>).map((c) => c.id);

        // 3. Atomic claim. WHERE status='pending' rejects any rows another
        //    worker swept up between steps 2 and 3.
        await this.engine.update(
            this.objectName,
            {
                status: 'in_flight',
                claimed_by: opts.nodeId,
                claimed_at: now,
                updated_at: now,
            },
            {
                where: { id: { $in: ids }, status: 'pending' },
                multi: true,
            },
        );

        // 4. Read back the rows we actually own.
        const claimed = (await this.engine.find(this.objectName, {
            where: {
                id: { $in: ids },
                claimed_by: opts.nodeId,
                claimed_at: now,
                status: 'in_flight',
            },
        })) as DeliveryRow[];

        return claimed.map((r) => this.toDelivery(r));
    }

    async ack(id: string, result: AckResult): Promise<void> {
        // ObjectQL has no atomic $inc across drivers, so read-then-write.
        // Safe enough: ack is single-writer per row (only the claimer acks).
        const current = (await this.engine.findOne(this.objectName, {
            where: { id },
            fields: ['attempts'],
        })) as { attempts?: number } | null;
        if (!current) return;

        const now = Date.now();
        let status: DeliveryStatus;
        let nextRetryAt: number | null;
        let error: string | null;

        if (result.success) {
            status = 'success';
            nextRetryAt = null;
            error = null;
        } else if (result.dead) {
            status = 'dead';
            nextRetryAt = null;
            error = result.error ?? null;
        } else {
            status = 'pending';
            nextRetryAt = result.nextRetryAt ?? null;
            error = result.error ?? null;
        }

        await this.engine.update(
            this.objectName,
            {
                status,
                attempts: (current.attempts ?? 0) + 1,
                last_attempted_at: now,
                claimed_by: null,
                claimed_at: null,
                response_code: result.httpStatus ?? null,
                response_body: result.responseBody ?? null,
                next_retry_at: nextRetryAt,
                error,
                updated_at: now,
            },
            { where: { id }, multi: false },
        );
    }

    async list(filter?: { status?: DeliveryStatus }): Promise<WebhookDelivery[]> {
        const rows = (await this.engine.find(this.objectName, {
            where: filter?.status ? { status: filter.status } : {},
        })) as DeliveryRow[];
        return rows.map((r) => this.toDelivery(r));
    }

    async redeliver(id: string): Promise<WebhookDelivery> {
        const current = (await this.engine.findOne(this.objectName, {
            where: { id },
        })) as DeliveryRow | null;
        if (!current) {
            throw new RedeliverError(
                `Delivery row '${id}' not found`,
                'not_found',
            );
        }
        if (
            current.status !== 'success' &&
            current.status !== 'failed' &&
            current.status !== 'dead'
        ) {
            throw new RedeliverError(
                `Delivery row '${id}' is '${current.status}', expected one of: success, failed, dead`,
                'not_eligible',
            );
        }
        const now = Date.now();
        // Guarded UPDATE — re-check status server-side so two concurrent
        // redeliver calls cannot both flip the row, and so a dispatcher
        // tick that flipped the row to in_flight between our SELECT and
        // UPDATE cannot be clobbered.
        await this.engine.update(
            this.objectName,
            {
                status: 'pending',
                attempts: 0,
                claimed_by: null,
                claimed_at: null,
                next_retry_at: null,
                last_attempted_at: null,
                response_code: null,
                response_body: null,
                error: null,
                updated_at: now,
            },
            {
                where: {
                    id,
                    status: { $in: ['success', 'failed', 'dead'] },
                },
                multi: false,
            },
        );
        const after = (await this.engine.findOne(this.objectName, {
            where: { id },
        })) as DeliveryRow | null;
        if (!after || after.status !== 'pending') {
            // Lost the race — another writer flipped the row.
            throw new RedeliverError(
                `Delivery row '${id}' state changed during redeliver`,
                'not_eligible',
            );
        }
        return this.toDelivery(after);
    }

    private toDelivery(r: DeliveryRow): WebhookDelivery {
        return {
            id: r.id,
            webhookId: r.webhook_id,
            eventId: r.event_id,
            eventType: r.event_type,
            url: r.url,
            method: r.method ?? undefined,
            headers: r.headers_json ? JSON.parse(r.headers_json) : undefined,
            secret: r.secret ?? undefined,
            timeoutMs: r.timeout_ms ?? undefined,
            payload: JSON.parse(r.payload_json),
            status: r.status,
            attempts: r.attempts,
            claimedBy: r.claimed_by ?? undefined,
            claimedAt: r.claimed_at ?? undefined,
            nextRetryAt: r.next_retry_at ?? undefined,
            lastAttemptedAt: r.last_attempted_at ?? undefined,
            responseCode: r.response_code ?? undefined,
            responseBody: r.response_body ?? undefined,
            error: r.error ?? undefined,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    }
}
