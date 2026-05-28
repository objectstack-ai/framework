// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Automation } from '@objectstack/spec';

/**
 * Stale Opportunity Alert
 *
 * A time-based workflow rule that fires at a scheduled interval
 * and identifies open opportunities that have not been updated
 * in 30+ days, then notifies the assigned owner.
 *
 * Uses `triggerType: 'schedule'` — evaluated on a recurring cadence
 * rather than on individual record create/update events.
 */
export const StaleOpportunityWorkflow: Automation.WorkflowRule = {
  name: 'crm_stale_opportunity_alert',
  objectName: 'crm_opportunity',
  triggerType: 'schedule',
  description:
    'Flags open opportunities that have not been updated in 30 days and notifies the sales rep.',
  criteria: `
    stage != "closed_won" &&
    stage != "closed_lost" &&
    now() - updated_at > duration("P30D")
  `,
  active: true,
  executionOrder: 200,
  reevaluateOnChange: false,
  actions: [
    {
      name: 'notify_stale_owner',
      type: 'email_alert',
      template: 'stale_opportunity_alert',
      recipients: ['{record.owner_email}'],
    },
    {
      name: 'create_followup_task',
      type: 'task_creation',
      taskObject: 'crm_activity',
      subject: 'Follow up on stale opportunity: {record.name}',
      description: 'This opportunity has not been updated in 30+ days. Please review and update.',
      dueDate: '{daysFromNow(3)}',
    },
  ],
};
