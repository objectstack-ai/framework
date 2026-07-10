// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_record_share — Per-Record Sharing Grant
 *
 * Bridges the ownership-only baseline established by `object.sharingModel`
 * with the real-world need to delegate access to a single record. Each
 * row says: "principal P has access level L on (object O, record R),
 * because of source S (manual grant or rule)."
 *
 * Enforcement lives in `@objectstack/plugin-sharing`:
 *   - For objects with `sharingModel: 'private'`, the engine middleware
 *     AND-s `{$or:[{owner_id:userId},{id:{$in:[grantedRecordIds]}}]}`
 *     into every `find` against that object.
 *   - For objects with `sharingModel: 'private' | 'read'`, the same
 *     middleware enforces edit/delete by checking ownership OR a share
 *     row with `access_level in ('edit','full')`.
 *
 * Conventions:
 *  - `object_name` is the short object name (e.g. `account`, `lead`).
 *  - `recipient_type` mirrors `ShareRecipientType` from the spec
 *    (`user` is enforced today; `group`/`position` are persisted for
 *    forward-compatibility).
 *  - `source = 'manual'` rows are created by a user via the REST
 *    `POST /data/:object/:id/shares` endpoint. `source = 'rule'` rows
 *    are materialised by the sharing-rule evaluator (future); the
 *    `source_id` lets the evaluator reconcile stale grants.
 *
 * @namespace sys
 */
export const SysRecordShare = ObjectSchema.create({
  name: 'sys_record_share',
  label: 'Record Share',
  pluralLabel: 'Record Shares',
  icon: 'share',
  isSystem: true,
  managedBy: 'system',
  description: 'Per-record sharing grant — extends OWD with explicit access',
  titleFormat: '{object_name}/{record_id} → {recipient_id} ({access_level})',
  highlightFields: ['object_name', 'record_id', 'recipient_id', 'access_level', 'source'],

  listViews: {
    granted_to_me: {
      type: 'grid',
      name: 'granted_to_me',
      label: 'Granted to Me',
      data: { provider: 'object', object: 'sys_record_share' },
      columns: ['object_name', 'record_id', 'access_level', 'source', 'granted_by', 'created_at'],
      filter: [
        { field: 'recipient_type', operator: 'equals', value: 'user' },
        { field: 'recipient_id', operator: 'equals', value: '{current_user_id}' },
      ],
      sort: [{ field: 'created_at', order: 'desc' }],
      pagination: { pageSize: 50 },
    },
    granted_by_me: {
      type: 'grid',
      name: 'granted_by_me',
      label: 'Granted by Me',
      data: { provider: 'object', object: 'sys_record_share' },
      columns: ['object_name', 'record_id', 'recipient_id', 'access_level', 'source', 'created_at'],
      filter: [
        { field: 'granted_by', operator: 'equals', value: '{current_user_id}' },
      ],
      sort: [{ field: 'created_at', order: 'desc' }],
      pagination: { pageSize: 50 },
    },
    by_object: {
      type: 'grid',
      name: 'by_object',
      label: 'By Object',
      data: { provider: 'object', object: 'sys_record_share' },
      columns: ['object_name', 'record_id', 'recipient_id', 'access_level', 'source', 'created_at'],
      sort: [{ field: 'object_name', order: 'asc' }, { field: 'created_at', order: 'desc' }],
      grouping: { fields: [{ field: 'object_name', order: 'asc', collapsed: false }] },
      pagination: { pageSize: 100 },
    },
    manual_grants: {
      type: 'grid',
      name: 'manual_grants',
      label: 'Manual Grants',
      data: { provider: 'object', object: 'sys_record_share' },
      columns: ['object_name', 'record_id', 'recipient_id', 'access_level', 'granted_by', 'reason', 'created_at'],
      filter: [{ field: 'source', operator: 'equals', value: 'manual' }],
      sort: [{ field: 'created_at', order: 'desc' }],
      pagination: { pageSize: 50 },
    },
    rule_grants: {
      type: 'grid',
      name: 'rule_grants',
      label: 'Rule Grants',
      data: { provider: 'object', object: 'sys_record_share' },
      columns: ['object_name', 'record_id', 'recipient_id', 'access_level', 'source_id', 'created_at'],
      filter: [{ field: 'source', operator: 'in', value: ['rule', 'team', 'inherited'] }],
      sort: [{ field: 'source_id', order: 'asc' }, { field: 'created_at', order: 'desc' }],
      pagination: { pageSize: 50 },
    },
    all_shares: {
      type: 'grid',
      name: 'all_shares',
      label: 'All',
      data: { provider: 'object', object: 'sys_record_share' },
      columns: ['object_name', 'record_id', 'recipient_type', 'recipient_id', 'access_level', 'source', 'created_at'],
      sort: [{ field: 'created_at', order: 'desc' }],
      pagination: { pageSize: 100 },
    },
  },

  fields: {
    id: Field.text({
      label: 'Share ID',
      required: true,
      readonly: true,
      group: 'System',
    }),

    // ── Target (which record is being shared) ────────────────────
    object_name: Field.text({
      label: 'Object',
      required: true,
      maxLength: 100,
      description: 'Short object name of the shared record',
      group: 'Target',
    }),

    record_id: Field.text({
      label: 'Record',
      required: true,
      maxLength: 100,
      description: 'Primary key of the shared record within object_name',
      group: 'Target',
    }),

    // ── Recipient (who receives access) ──────────────────────────
    recipient_type: Field.select(
      ['user', 'group', 'position', 'unit_and_subordinates', 'guest'],
      {
        label: 'Recipient Type',
        required: true,
        defaultValue: 'user',
        description: 'Kind of principal that holds the grant',
        group: 'Recipient',
      },
    ),

    recipient_id: Field.text({
      label: 'Recipient',
      required: true,
      maxLength: 100,
      description: 'ID of the user/group/position that receives access',
      group: 'Recipient',
    }),

    access_level: Field.select(
      ['read', 'edit', 'full'],
      {
        label: 'Access Level',
        required: true,
        defaultValue: 'read',
        description: 'What the recipient can do — read | edit | full (transfer/share/delete)',
        group: 'Recipient',
      },
    ),

    // ── Provenance ───────────────────────────────────────────────
    source: Field.select(
      ['manual', 'rule', 'team', 'inherited'],
      {
        label: 'Source',
        required: true,
        defaultValue: 'manual',
        description: 'Why this grant exists — used by the rule evaluator to reconcile',
        group: 'Provenance',
      },
    ),

    source_id: Field.text({
      label: 'Source ID',
      required: false,
      maxLength: 200,
      description: 'Rule name / team id when source != manual',
      group: 'Provenance',
    }),

    granted_by: Field.lookup('sys_user', {
      label: 'Granted By',
      required: false,
      description: 'User that created the grant (manual only)',
      group: 'Provenance',
    }),

    reason: Field.text({
      label: 'Reason',
      required: false,
      maxLength: 500,
      description: 'Optional free-text explanation surfaced to the recipient',
      group: 'Provenance',
    }),

    // ── Lifecycle ────────────────────────────────────────────────
    created_at: Field.datetime({
      label: 'Created At',
      required: true,
      defaultValue: 'NOW()',
      readonly: true,
      group: 'System',
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      required: false,
      group: 'System',
    }),
  },

  indexes: [
    // Hot path: "all records visible to user U on object O" — the
    // middleware reads (object_name, recipient_type, recipient_id) to
    // build the `id IN (...)` predicate on every find.
    { fields: ['object_name', 'recipient_type', 'recipient_id'] },
    // "all grants on this record" — used by the share-management UI
    // and by canEdit() to look up explicit grants.
    { fields: ['object_name', 'record_id'] },
    // Reconciliation key for rule-driven shares.
    { fields: ['source', 'source_id'] },
  ],
});
