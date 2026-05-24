// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { Field, ObjectSchema } from '@objectstack/spec/data';

/**
 * sys_webhook_delivery — Durable outbox row for one HTTP attempt.
 *
 * Schema is owned by `@objectstack/plugin-webhooks`. Add it to your stack
 * via:
 *
 *   import { SysWebhookDelivery } from '@objectstack/plugin-webhooks/schema';
 *   defineStack({ objects: [SysWebhookDelivery, ...], plugins: [...] });
 *
 * Designed for the SqlWebhookOutbox claim algorithm:
 *
 *   1. Producers INSERT pending rows (dedup'd by (event_id, webhook_id)).
 *   2. The dispatcher's per-partition lock-holder runs:
 *        SELECT id WHERE status='pending' AND partition_key=? AND (next_retry_at <= now OR null)
 *        UPDATE SET status='in_flight' WHERE id IN (...) AND status='pending'  ← atomic claim
 *        POST to target URL
 *        UPDATE SET status=success/pending/dead, attempts=attempts+1, ...
 *
 * `partition_key` is precomputed on enqueue (hash(webhook_id) mod N) so the
 * dispatcher can filter cheaply without DB-side hash functions.
 *
 * Indexes are tuned for the hot path: `(status, partition_key, next_retry_at)`
 * is the claim query; `(event_id, webhook_id)` is the dedup uniqueness.
 *
 * @namespace sys
 */
export const SysWebhookDelivery = ObjectSchema.create({
    name: 'sys_webhook_delivery',
    label: 'Webhook Delivery',
    pluralLabel: 'Webhook Deliveries',
    icon: 'package',
    isSystem: true,
    managedBy: 'config',
    userActions: { create: false, edit: false, delete: false, import: false },
    description:
        'Durable outbox row for one webhook attempt. Managed by @objectstack/plugin-webhooks; do not write directly.',
    displayNameField: 'id',
    titleFormat: '{event_type} → {url}',
    compactLayout: ['event_type', 'url', 'status', 'attempts', 'next_retry_at'],

    actions: [
        {
            name: 'redeliver',
            label: 'Redeliver',
            icon: 'refresh-cw',
            variant: 'secondary',
            locations: ['list_item', 'record_header'],
            type: 'api',
            target: '/api/v1/webhooks/redeliver',
            method: 'POST',
            recordIdParam: 'deliveryId',
            confirmText:
                'Replay this delivery? The receiver will get the original payload again — they must be idempotent on the X-Objectstack-Delivery header.',
            successMessage: 'Queued for redelivery',
            refreshAfter: true,
            // Only terminal rows are safe to replay. Pending / in_flight rows
            // are either already queued or actively being sent — replaying
            // would double-deliver.
            disabled: "!(status in ['success', 'failed', 'dead'])",
        },
    ],

    listViews: {
        recent: {
            type: 'grid',
            name: 'recent',
            label: 'Recent',
            data: { provider: 'object', object: 'sys_webhook_delivery' },
            columns: ['event_type', 'url', 'status', 'attempts', 'response_code', 'updated_at'],
            sort: [{ field: 'updated_at', order: 'desc' }],
            pagination: { pageSize: 50 },
        },
        failures: {
            type: 'grid',
            name: 'failures',
            label: 'Failures',
            data: { provider: 'object', object: 'sys_webhook_delivery' },
            columns: ['event_type', 'url', 'status', 'attempts', 'response_code', 'error', 'updated_at'],
            filter: [{ field: 'status', operator: 'in', value: ['failed', 'dead'] }],
            sort: [{ field: 'updated_at', order: 'desc' }],
            pagination: { pageSize: 50 },
        },
        in_flight: {
            type: 'grid',
            name: 'in_flight',
            label: 'In Flight',
            data: { provider: 'object', object: 'sys_webhook_delivery' },
            columns: ['event_type', 'url', 'attempts', 'claimed_by', 'claimed_at'],
            filter: [{ field: 'status', operator: 'equals', value: 'in_flight' }],
            sort: [{ field: 'claimed_at', order: 'desc' }],
            pagination: { pageSize: 50 },
        },
        pending: {
            type: 'grid',
            name: 'pending',
            label: 'Pending',
            data: { provider: 'object', object: 'sys_webhook_delivery' },
            columns: ['event_type', 'url', 'attempts', 'next_retry_at', 'updated_at'],
            filter: [{ field: 'status', operator: 'equals', value: 'pending' }],
            sort: [{ field: 'next_retry_at', order: 'asc' }],
            pagination: { pageSize: 50 },
        },
        by_status: {
            type: 'grid',
            name: 'by_status',
            label: 'By Status',
            data: { provider: 'object', object: 'sys_webhook_delivery' },
            columns: ['status', 'event_type', 'url', 'attempts', 'updated_at'],
            sort: [{ field: 'status', order: 'asc' }, { field: 'updated_at', order: 'desc' }],
            grouping: { fields: [{ field: 'status', order: 'asc', collapsed: false }] },
            pagination: { pageSize: 100 },
        },
        by_webhook: {
            type: 'grid',
            name: 'by_webhook',
            label: 'By Webhook',
            data: { provider: 'object', object: 'sys_webhook_delivery' },
            columns: ['webhook_id', 'event_type', 'status', 'attempts', 'updated_at'],
            sort: [{ field: 'webhook_id', order: 'asc' }, { field: 'updated_at', order: 'desc' }],
            grouping: { fields: [{ field: 'webhook_id', order: 'asc', collapsed: true }] },
            pagination: { pageSize: 100 },
        },
        all_deliveries: {
            type: 'grid',
            name: 'all_deliveries',
            label: 'All',
            data: { provider: 'object', object: 'sys_webhook_delivery' },
            columns: ['event_type', 'url', 'status', 'attempts', 'response_code', 'updated_at'],
            sort: [{ field: 'updated_at', order: 'desc' }],
            pagination: { pageSize: 100 },
        },
    },

    fields: {
        id: Field.text({
            label: 'Delivery ID',
            required: true,
            maxLength: 64,
            description: 'UUID — also doubles as the receiver-side idempotency key',
        }),

        webhook_id: Field.text({
            label: 'Webhook ID',
            required: true,
            maxLength: 64,
            description: 'FK to sys_webhook.id (loosely coupled — denormalised URL/secret on row)',
        }),

        event_id: Field.text({
            label: 'Event ID',
            required: true,
            maxLength: 128,
            description: 'Source event id; UNIQUE(event_id, webhook_id) for dedup',
        }),

        event_type: Field.text({
            label: 'Event Type',
            required: true,
            maxLength: 128,
            description: 'e.g. data.record.created',
        }),

        url: Field.text({
            label: 'Target URL',
            required: true,
            maxLength: 2048,
            description: 'Snapshotted at enqueue so config edits do not rewrite live rows',
        }),

        method: Field.text({ label: 'Method', required: false, maxLength: 10 }),
        headers_json: Field.textarea({ label: 'Headers JSON', required: false }),
        secret: Field.text({ label: 'HMAC Secret', required: false, maxLength: 256 }),
        timeout_ms: Field.number({ label: 'Timeout (ms)', required: false }),
        payload_json: Field.textarea({ label: 'Payload JSON', required: true }),

        partition_key: Field.number({
            label: 'Partition',
            required: true,
            description: 'hash(webhook_id) mod partitionCount — precomputed for cheap WHERE',
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
            description: 'Number of POST attempts made so far',
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
        { fields: ['event_id', 'webhook_id'], unique: true },
        // Hot path: claim query
        { fields: ['status', 'partition_key', 'next_retry_at'] },
        // Reaper: scan stale in_flight rows by claimed_at
        { fields: ['status', 'claimed_at'] },
        { fields: ['webhook_id'] },
    ],
});

/** Canonical object name — exported so SqlWebhookOutbox callers can override if needed. */
export const SYS_WEBHOOK_DELIVERY = 'sys_webhook_delivery' as const;
