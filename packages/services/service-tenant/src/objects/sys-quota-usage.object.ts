// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_quota_usage — Metered usage counter for a project/branch metric.
 *
 * Recorded per (organization, project, branch, metric, window). Rolls
 * up into `sys_billing_period.total_amount` at period close. Also drives
 * real-time quota enforcement: when `value >= limit_value` the dispatcher
 * can throttle / deny further writes for the given metric.
 *
 * Cloud-control only.
 *
 * @namespace sys
 */
export const SysQuotaUsage = ObjectSchema.create({
  name: 'sys_quota_usage',
  label: 'Quota Usage',
  pluralLabel: 'Quota Usage',
  icon: 'gauge',
  isSystem: true,
  managedBy: 'config',
  description: 'Metered counter per metric per window — drives billing + quota enforcement.',
  displayNameField: 'metric',
  titleFormat: '{metric} — {window_start}',
  compactLayout: ['organization_id', 'environment_id', 'metric', 'value', 'limit_value', 'window_start'],
  userActions: { create: false, edit: false, delete: false, import: false },

  listViews: {
    over_limit: {
      type: 'grid',
      name: 'over_limit',
      label: 'Over Limit',
      data: { provider: 'object', object: 'sys_quota_usage' },
      columns: ['organization_id', 'environment_id', 'metric', 'value', 'limit_value', 'window_start'],
      filter: [{ field: 'is_over_limit', operator: 'equals', value: true }],
      sort: [{ field: 'window_start', order: 'desc' }],
      pagination: { pageSize: 100 },
    },
    by_environment: {
      type: 'grid',
      name: 'by_environment',
      label: 'By Environment',
      data: { provider: 'object', object: 'sys_quota_usage' },
      columns: ['environment_id', 'metric', 'value', 'limit_value', 'window_start'],
      sort: [{ field: 'environment_id', order: 'asc' }, { field: 'window_start', order: 'desc' }],
      grouping: { fields: [{ field: 'environment_id', order: 'asc', collapsed: false }] },
      pagination: { pageSize: 100 },
    },
    current_window: {
      type: 'grid',
      name: 'current_window',
      label: 'Current Window',
      data: { provider: 'object', object: 'sys_quota_usage' },
      columns: ['organization_id', 'environment_id', 'metric', 'value', 'limit_value'],
      sort: [{ field: 'value', order: 'desc' }],
      pagination: { pageSize: 100 },
    },
  },

  fields: {
    id: Field.text({ label: 'Usage ID', required: true, readonly: true, group: 'System' }),

    organization_id: Field.lookup('sys_organization', {
      label: 'Organization',
      required: true,
      group: 'Scope',
    }),

    environment_id: Field.lookup('sys_environment', {
      label: 'Environment',
      required: false,
      group: 'Scope',
    }),

    branch_id: Field.lookup('sys_project_branch', {
      label: 'Branch',
      required: false,
      group: 'Scope',
    }),

    period_id: Field.lookup('sys_billing_period', {
      label: 'Billing Period',
      required: false,
      description: 'Optional rollup link; set when the window closes.',
      group: 'Scope',
    }),

    metric: Field.text({
      label: 'Metric',
      required: true,
      maxLength: 64,
      description: 'e.g. api_requests / storage_bytes / active_users / function_seconds',
      group: 'Definition',
    }),

    window_start: Field.datetime({
      label: 'Window Start',
      required: true,
      group: 'Definition',
    }),

    window_end: Field.datetime({
      label: 'Window End',
      required: true,
      group: 'Definition',
    }),

    value: Field.number({
      label: 'Value',
      defaultValue: 0,
      description: 'Observed count in this window.',
      group: 'Measurement',
    }),

    limit_value: Field.number({
      label: 'Limit',
      required: false,
      description: 'Plan limit; blank = unlimited.',
      group: 'Measurement',
    }),

    unit: Field.text({
      label: 'Unit',
      required: false,
      maxLength: 32,
      description: 'count | bytes | seconds | requests',
      group: 'Measurement',
    }),

    is_over_limit: Field.boolean({
      label: 'Over Limit',
      defaultValue: false,
      readonly: true,
      group: 'Measurement',
    }),

    created_at: Field.datetime({ label: 'Created At', defaultValue: 'NOW()', readonly: true, group: 'System' }),
    updated_at: Field.datetime({ label: 'Updated At', defaultValue: 'NOW()', readonly: true, group: 'System' }),
  },

  indexes: [
    { fields: ['organization_id', 'environment_id', 'metric', 'window_start'], unique: true },
    { fields: ['period_id'] },
    { fields: ['is_over_limit'] },
  ],
});
