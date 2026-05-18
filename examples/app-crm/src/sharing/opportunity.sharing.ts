import { P } from '@objectstack/spec';
// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/** Share high-value open opportunities with management */
export const OpportunitySalesSharingRule = {
  name: 'opportunity_sales_sharing',
  label: 'Opportunity Sales Team Sharing',
  object: 'opportunity',
  type: 'criteria' as const,
  condition: P`!(record.stage in ["closed_won", "closed_lost"]) && record.amount >= 100000`,
  accessLevel: 'read' as const,
  sharedWith: { type: 'role_and_subordinates' as const, value: 'sales_director' },
};
