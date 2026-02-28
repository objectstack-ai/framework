// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Action } from '@objectstack/spec/ui';

/** Clone Opportunity */
export const CloneOpportunityAction: Action = {
  name: 'clone_opportunity',
  label: 'Clone Opportunity',
  icon: 'copy',
  type: 'script',
  target: 'cloneRecord',
  locations: ['record_header', 'record_more'],
  successMessage: 'Opportunity cloned successfully!',
  refreshAfter: true,
};

/** Mass Update Opportunity Stage */
export const MassUpdateStageAction: Action = {
  name: 'mass_update_stage',
  label: 'Update Stage',
  icon: 'layers',
  type: 'modal',
  target: 'mass_update_stage_modal',
  locations: ['list_toolbar'],
  params: [
    {
      name: 'stage',
      label: 'New Stage',
      type: 'select',
      required: true,
      options: [
        { label: 'Prospecting', value: 'prospecting' },
        { label: 'Qualification', value: 'qualification' },
        { label: 'Needs Analysis', value: 'needs_analysis' },
        { label: 'Proposal', value: 'proposal' },
        { label: 'Negotiation', value: 'negotiation' },
        { label: 'Closed Won', value: 'closed_won' },
        { label: 'Closed Lost', value: 'closed_lost' },
      ]
    }
  ],
  successMessage: 'Opportunities updated successfully!',
  refreshAfter: true,
};
