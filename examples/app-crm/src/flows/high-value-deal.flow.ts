// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Flow } from '@objectstack/spec/automation';

/**
 * High-Value Deal alert — record-triggered flow.
 *
 * Migrated from the legacy `workflow` metadata type (retired in ADR-0020,
 * which reclaims the runtime FSM as the `state_machine` validation rule on
 * the object and folds side-effecting automation into Flow). The original
 * rule fired when a `crm_opportunity` crossed the $100k threshold and
 * notified sales managers; that side effect is exactly a record-triggered
 * Flow.
 *
 * The lifecycle/transition aspect (open → high_value → won/lost) is no
 * longer modelled here — record state transitions belong on the object as a
 * `state_machine` validation rule (see opportunity.object.ts). This Flow
 * carries only the notification side effect.
 */
export const HighValueDealFlow: Flow = {
  name: 'high_value_deal_alert',
  label: 'Notify on High-Value Deal',
  description: 'Notifies sales managers when an opportunity amount crosses the $100k threshold.',
  type: 'autolaunched',

  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'On Opportunity Update',
      config: {
        objectName: 'crm_opportunity',
        triggerType: 'record-after-update',
        // Fire only on the upward crossing of the threshold, not on every
        // save of an already-high-value deal.
        condition: 'amount > 100000 && (previous.amount == null || previous.amount <= 100000)',
      },
    },
    {
      id: 'notify_managers',
      type: 'script',
      label: 'Notify Sales Managers',
      config: {
        actionType: 'email',
        inputs: {
          to: '{record.owner_manager_email}',
          subject: '💰 High-Value Deal: {record.name}',
          template: 'high_value_deal_alert',
        },
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'notify_managers' },
    { id: 'e2', source: 'notify_managers', target: 'end' },
  ],
};
