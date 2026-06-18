// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { JobInput } from '@objectstack/spec/system';

/**
 * Nightly lead-scoring job — recomputes `lead_score` for all open leads.
 * Handler key 'scoreLeads' must be registered in defineStack({ functions }).
 */
export const LeadScoringJob: JobInput = {
  name: 'crm_lead_scoring',
  label: 'Nightly Lead Score Refresh',
  description: 'Recalculates lead_score for all open leads using engagement signals.',
  schedule: {
    type: 'cron',
    expression: '0 2 * * *',
    timezone: 'UTC',
  },
  handler: 'scoreLeads',
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 5000,
    backoffMultiplier: 2,
  },
  timeout: 300000,
  enabled: true,
};

/**
 * Weekly pipeline report — aggregates deal data and emails managers.
 */
export const PipelineReportJob: JobInput = {
  name: 'crm_pipeline_report',
  label: 'Weekly Pipeline Report',
  description: 'Generates and emails weekly pipeline summary to sales managers.',
  schedule: {
    type: 'cron',
    expression: '0 8 * * 1',
    timezone: 'UTC',
  },
  handler: 'generatePipelineReport',
  retryPolicy: {
    maxRetries: 1,
    backoffMs: 10000,
    backoffMultiplier: 1,
  },
  timeout: 120000,
  enabled: true,
};

/**
 * Daily renewal reminder sweep — kicks off renewal_reminder_flow for
 * opportunities nearing contract expiry.
 */
export const RenewalSweepJob: JobInput = {
  name: 'crm_renewal_sweep',
  label: 'Daily Renewal Reminder Sweep',
  description: 'Scans contracts expiring within 30 days and enqueues reminder flows.',
  schedule: {
    type: 'cron',
    expression: '0 9 * * *',
    timezone: 'UTC',
  },
  handler: 'sweepRenewals',
  timeout: 60000,
  enabled: true,
};
