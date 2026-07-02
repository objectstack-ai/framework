// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_job_queue — Durable Background Job / Message Queue + DLQ
 *
 * The persistent backing store for `DbQueueAdapter`. Each row is one
 * enqueued message — pending until a worker leases (`status='running'`),
 * then `completed`, `failed`, or finally `dlq` after exhausting retries.
 *
 * DLQ rows are simply `status='dlq'` rows in this same table; no separate
 * table needed. Listing/replay is a filter on `status`.
 *
 * Idempotency: `idempotency_key` + `queue` are deduplicated by the adapter
 * over a configurable window (default 24h) — the column is indexed.
 *
 * Concurrency: workers claim a row by CAS-updating `status` from `pending`
 * to `running` plus setting `locked_by`/`locked_until`. Reads only return
 * rows whose lock has not been claimed (or whose lease expired).
 *
 * Writers: `DbQueueAdapter` (publish/lease/complete/fail).
 * Readers: Studio DLQ view, ops dashboards, the adapter's worker loop.
 *
 * @namespace sys
 */
export const SysJobQueue = ObjectSchema.create({
  name: 'sys_job_queue',
  label: 'Job Queue Message',
  pluralLabel: 'Job Queue Messages',
  icon: 'inbox',
  isSystem: true,
  managedBy: 'system',
  description: 'Durable job/message queue including dead letters',
  displayNameField: 'queue',
  nameField: 'queue', // [ADR-0079] canonical primary-title pointer (mirrors deprecated displayNameField)
  titleFormat: '{queue} #{id}',
  highlightFields: ['queue', 'status', 'attempts', 'scheduled_for', 'last_error'],

  fields: {
    id: Field.text({ label: 'Message ID', required: true, readonly: true, group: 'System' }),

    queue: Field.text({
      label: 'Queue',
      required: true,
      maxLength: 255,
      searchable: true,
      description: 'Logical queue name (snake_case)',
      group: 'Identity',
    }),

    idempotency_key: Field.text({
      label: 'Idempotency Key',
      required: false,
      maxLength: 255,
      description: 'Deduplication key within (queue, window)',
      group: 'Identity',
    }),

    payload_json: Field.textarea({
      label: 'Payload (JSON)',
      required: false,
      description: 'Serialized message body',
      group: 'Content',
    }),

    metadata_json: Field.textarea({
      label: 'Metadata (JSON)',
      required: false,
      description: 'Serialized metadata bag (tenant_id, source_record, ...)',
      group: 'Content',
    }),

    status: Field.select(
      ['pending', 'running', 'completed', 'failed', 'dlq'],
      {
        label: 'Status',
        required: true,
        defaultValue: 'pending',
        description: 'Lifecycle state',
        group: 'State',
      },
    ),

    priority: Field.number({
      label: 'Priority',
      required: false,
      defaultValue: 100,
      description: 'Lower = higher priority',
      group: 'Schedule',
    }),

    attempts: Field.number({ label: 'Attempts', required: false, defaultValue: 0, group: 'State' }),
    max_attempts: Field.number({ label: 'Max Attempts', required: false, defaultValue: 3, group: 'State' }),

    backoff_type: Field.select(
      ['fixed', 'exponential'],
      { label: 'Backoff', required: false, defaultValue: 'exponential', group: 'Schedule' },
    ),
    backoff_delay_ms: Field.number({
      label: 'Backoff Base (ms)',
      required: false,
      defaultValue: 1000,
      group: 'Schedule',
    }),
    backoff_max_delay_ms: Field.number({
      label: 'Backoff Cap (ms)',
      required: false,
      group: 'Schedule',
    }),

    scheduled_for: Field.datetime({
      label: 'Scheduled For',
      required: false,
      description: 'Earliest time a worker may lease this message',
      group: 'Schedule',
    }),

    locked_by: Field.text({
      label: 'Locked By',
      required: false,
      maxLength: 255,
      description: 'Worker id holding the lease',
      group: 'Lease',
    }),
    locked_until: Field.datetime({
      label: 'Locked Until',
      required: false,
      description: 'Lease expiry; if past, another worker may claim',
      group: 'Lease',
    }),

    last_error: Field.textarea({ label: 'Last Error', required: false, group: 'State' }),
    completed_at: Field.datetime({ label: 'Completed At', required: false, group: 'State' }),

    created_at: Field.datetime({
      label: 'Created At',
      required: true,
      defaultValue: 'NOW()',
      readonly: true,
      group: 'System',
    }),
    updated_at: Field.datetime({ label: 'Updated At', required: false, group: 'System' }),
  },

  indexes: [
    { fields: ['queue', 'status', 'scheduled_for'] },
    { fields: ['idempotency_key', 'queue'] },
    { fields: ['status'] },
  ],
});
