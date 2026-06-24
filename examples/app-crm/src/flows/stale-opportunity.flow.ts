// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Flow } from '@objectstack/spec/automation';

/**
 * Stale Opportunity sweep — scheduled flow.
 *
 * Migrated from the legacy time-based `workflow` metadata type (retired in
 * ADR-0020). The original rule ran on a schedule, found open
 * `crm_opportunity` records untouched for 30+ days, and (a) emailed the
 * owner and (b) created a follow-up task. A scheduled sweep with
 * side-effecting actions is precisely a schedule-triggered Flow, so it now
 * lives here rather than as a bespoke workflow metadata type.
 */
export const StaleOpportunityFlow: Flow = {
  name: 'stale_opportunity_sweep',
  label: 'Stale Opportunity Sweep',
  description: 'Daily sweep that notifies owners of open opportunities untouched for 30+ days and opens a follow-up task.',
  type: 'schedule',
  // A scheduled run has no trigger user, so it must declare its elevation: this
  // sweep spans every owner's opportunities and opens follow-up tasks across
  // them. Without this it would run UNSCOPED by default. (ADR-0049 / #1888)
  runAs: 'system',

  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'Daily Schedule',
      config: {
        triggerType: 'schedule',
        // Every day at 08:00 — re-evaluate open opportunities for staleness.
        cron: '0 8 * * *',
        objectName: 'crm_opportunity',
        filter: "stage != 'closed_won' && stage != 'closed_lost' && last_modified < daysAgo(30)",
      },
    },
    {
      id: 'notify_owner',
      type: 'script',
      label: 'Notify Owner',
      config: {
        actionType: 'email',
        inputs: {
          to: '{record.owner_email}',
          subject: '⏰ Stale Opportunity: {record.name}',
          template: 'stale_opportunity_alert',
        },
      },
    },
    {
      id: 'open_followup_task',
      type: 'create_record',
      label: 'Open Follow-up Task',
      config: {
        objectName: 'crm_activity',
        inputs: {
          subject: 'Follow up on stale opportunity: {record.name}',
          description: 'This opportunity has not been updated in 30+ days. Please review and update.',
          due_date: '{daysFromNow(3)}',
          related_to: '{record.id}',
        },
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'notify_owner' },
    { id: 'e2', source: 'notify_owner', target: 'open_followup_task' },
    { id: 'e3', source: 'open_followup_task', target: 'end' },
  ],
};
