// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_job_run — Background Job Execution History
 *
 * Each row is one execution of a registered job (`sys_job`). Stores
 * outcome, duration, error, and whether the run was a manual trigger or
 * a scheduled tick. Replaces the in-memory `executions[]` array from
 * `IntervalJobAdapter`.
 *
 * Writers: the active job adapter.
 * Readers: Studio "Job Runs" view, dashboards, alerting.
 *
 * @namespace sys
 */
export const SysJobRun = ObjectSchema.create({
  name: 'sys_job_run',
  label: 'Job Run',
  pluralLabel: 'Job Runs',
  icon: 'play',
  isSystem: true,
  managedBy: 'append-only',
  description: 'Background job execution audit trail',
  displayNameField: 'job_name',
  nameField: 'job_name', // [ADR-0079] canonical primary-title pointer (mirrors deprecated displayNameField)
  titleFormat: '{job_name} @ {started_at}',
  highlightFields: ['job_name', 'status', 'started_at', 'duration_ms', 'attempt'],

  fields: {
    id: Field.text({ label: 'Run ID', required: true, readonly: true, group: 'System' }),

    job_name: Field.text({
      label: 'Job',
      required: true,
      maxLength: 255,
      searchable: true,
      group: 'Identity',
    }),

    status: Field.select(
      ['running', 'success', 'failed', 'timeout'],
      { label: 'Status', required: true, defaultValue: 'running', group: 'State' },
    ),

    started_at: Field.datetime({ label: 'Started At', required: true, group: 'State' }),
    completed_at: Field.datetime({ label: 'Completed At', required: false, group: 'State' }),
    duration_ms: Field.number({ label: 'Duration (ms)', required: false, group: 'State' }),
    attempt: Field.number({
      label: 'Attempt',
      required: false,
      defaultValue: 1,
      description: '1 for first run, >1 for retries/replays',
      group: 'State',
    }),

    trigger: Field.select(
      ['schedule', 'manual', 'replay'],
      { label: 'Trigger', required: false, defaultValue: 'schedule', group: 'State' },
    ),

    error: Field.textarea({ label: 'Error', required: false, group: 'State' }),

    created_at: Field.datetime({
      label: 'Created At',
      required: true,
      defaultValue: 'NOW()',
      readonly: true,
      group: 'System',
    }),
  },

  indexes: [
    { fields: ['job_name', 'started_at'] },
    { fields: ['status', 'started_at'] },
  ],
});
