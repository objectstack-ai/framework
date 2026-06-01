// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { Field, ObjectSchema } from '@objectstack/spec/data';

/**
 * `sys_http_delivery` — durable outbox row for one outbound-HTTP attempt
 * (ADR-0018 M3).
 *
 * The raw-callout counterpart to `sys_notification_delivery` (recipient/channel
 * deliveries). Shared by the Flow `http` node executor and webhook fan-out so
 * both inherit retry / idempotency / dead-letter from one substrate. Generalises
 * `sys_webhook_delivery`: `webhook_id`→`ref_id`, `event_id`→`dedup_key`,
 * `event_type`→`label`, `secret`→`signing_secret`.
 *
 * Designed for the SqlHttpOutbox claim algorithm:
 *   1. Producers INSERT pending rows (dedup'd by `(source, dedup_key)`).
 *   2. The per-partition lock-holder runs:
 *        SELECT id WHERE status='pending' AND partition_key=? AND (next_retry_at <= now OR null)
 *        UPDATE SET status='in_flight' WHERE id IN (...) AND status='pending'  ← atomic claim
 *        POST to target URL
 *        UPDATE SET status=success/pending/dead, attempts=attempts+1, ...
 *
 * `partition_key` is precomputed on enqueue (`hash(ref_id) mod N`) so the
 * dispatcher filters cheaply without DB-side hash functions.
 *
 * @namespace sys
 */
export const HttpDelivery = ObjectSchema.create({
    name: 'sys_http_delivery',
    label: 'HTTP Delivery',
    pluralLabel: 'HTTP Deliveries',
    icon: 'globe',
    isSystem: true,
    managedBy: 'system',
    userActions: { create: false, edit: false, delete: false, import: false },
    description:
        'Durable outbox row for one outbound-HTTP attempt (ADR-0018). Managed by @objectstack/service-messaging; do not write directly.',
    displayNameField: 'id',
    titleFormat: '{label} → {url}',
    compactLayout: ['source', 'url', 'status', 'attempts', 'next_retry_at'],

    listViews: {
        recent: {
            type: 'grid',
            name: 'recent',
            label: 'Recent',
            data: { provider: 'object', object: 'sys_http_delivery' },
            columns: ['source', 'label', 'url', 'status', 'attempts', 'response_code', 'updated_at'],
            sort: [{ field: 'updated_at', order: 'desc' }],
            pagination: { pageSize: 50 },
        },
        failures: {
            type: 'grid',
            name: 'failures',
            label: 'Failures',
            data: { provider: 'object', object: 'sys_http_delivery' },
            columns: ['source', 'url', 'status', 'attempts', 'response_code', 'error', 'updated_at'],
            filter: [{ field: 'status', operator: 'in', value: ['failed', 'dead'] }],
            sort: [{ field: 'updated_at', order: 'desc' }],
            pagination: { pageSize: 50 },
        },
        pending: {
            type: 'grid',
            name: 'pending',
            label: 'Pending',
            data: { provider: 'object', object: 'sys_http_delivery' },
            columns: ['source', 'url', 'attempts', 'next_retry_at', 'updated_at'],
            filter: [{ field: 'status', operator: 'equals', value: 'pending' }],
            sort: [{ field: 'next_retry_at', order: 'asc' }],
            pagination: { pageSize: 50 },
        },
    },

    fields: {
        id: Field.text({
            label: 'Delivery ID',
            required: true,
            maxLength: 64,
            description: 'UUID — also doubles as the receiver-side idempotency key',
        }),

        source: Field.text({
            label: 'Source',
            required: true,
            maxLength: 32,
            description: "Provenance domain, e.g. 'webhook' | 'flow'. UNIQUE(source, dedup_key).",
        }),

        ref_id: Field.text({
            label: 'Ref ID',
            required: true,
            maxLength: 128,
            description: 'Partition/ordering anchor within source (webhook id, flow id, …)',
        }),

        dedup_key: Field.text({
            label: 'Dedup Key',
            required: true,
            maxLength: 191,
            description: 'UNIQUE(source, dedup_key) for at-most-once enqueue',
        }),

        label: Field.text({
            label: 'Label',
            required: false,
            maxLength: 191,
            description: 'Diagnostic label / event type — surfaced on X-Objectstack-Event',
        }),

        url: Field.text({
            label: 'Target URL',
            required: true,
            maxLength: 2048,
            description: 'Snapshotted at enqueue so config edits do not rewrite live rows',
        }),

        method: Field.text({ label: 'Method', required: false, maxLength: 10 }),
        headers_json: Field.textarea({ label: 'Headers JSON', required: false }),
        signing_secret: Field.text({ label: 'HMAC Secret', required: false, maxLength: 256 }),
        timeout_ms: Field.number({ label: 'Timeout (ms)', required: false }),
        payload_json: Field.textarea({ label: 'Payload JSON', required: true }),

        partition_key: Field.number({
            label: 'Partition',
            required: true,
            description: 'hash(ref_id) mod partitionCount — precomputed for cheap WHERE',
        }),

        status: Field.text({
            label: 'Status',
            required: true,
            defaultValue: 'pending',
            maxLength: 16,
            description: 'pending | in_flight | success | failed | dead',
        }),

        attempts: Field.number({
            label: 'Attempts',
            required: true,
            defaultValue: 0,
            description: 'Number of attempts made so far',
        }),

        claimed_by: Field.text({ label: 'Claimed By', required: false, maxLength: 128 }),
        claimed_at: Field.number({ label: 'Claimed At (ms)', required: false }),
        next_retry_at: Field.number({ label: 'Next Retry At (ms)', required: false }),
        last_attempted_at: Field.number({ label: 'Last Attempted At (ms)', required: false }),
        response_code: Field.number({ label: 'HTTP Status', required: false }),
        response_body: Field.textarea({ label: 'Response Body (capped)', required: false }),
        error: Field.textarea({ label: 'Error', required: false }),

        created_at: Field.number({ label: 'Created At (ms)', required: true }),
        updated_at: Field.number({ label: 'Updated At (ms)', required: true }),
    },

    indexes: [
        { fields: ['source', 'dedup_key'], unique: true },
        // Hot path: claim query
        { fields: ['status', 'partition_key', 'next_retry_at'] },
        // Reaper: scan stale in_flight rows by claimed_at
        { fields: ['status', 'claimed_at'] },
        { fields: ['source', 'ref_id'] },
    ],
});

/** Canonical object name — exported so SqlHttpOutbox callers can override. */
export const SYS_HTTP_DELIVERY = 'sys_http_delivery' as const;
