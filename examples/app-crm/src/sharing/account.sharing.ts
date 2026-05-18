import { P } from '@objectstack/spec';
// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/** Share accounts with sales managers/directors based on customer status */
export const AccountTeamSharingRule = {
  name: 'account_team_sharing',
  label: 'Account Team Sharing',
  object: 'account',
  type: 'criteria' as const,
  condition: P`record.type == "customer" && record.is_active == true`,
  accessLevel: 'edit' as const,
  sharedWith: { type: 'role' as const, value: 'sales_manager' },
};

/** Territory-Based Sharing (criteria-based, by billing country) */
export const TerritorySharingRules = [
  {
    name: 'north_america_territory',
    label: 'North America Territory',
    object: 'account',
    type: 'criteria' as const,
    condition: P`record.billing_country in ["US", "CA", "MX"]`,
    accessLevel: 'edit' as const,
    sharedWith: { type: 'role' as const, value: 'na_sales_team' },
  },
  {
    name: 'europe_territory',
    label: 'Europe Territory',
    object: 'account',
    type: 'criteria' as const,
    condition: P`record.billing_country in ["UK", "DE", "FR", "IT", "ES"]`,
    accessLevel: 'edit' as const,
    sharedWith: { type: 'role' as const, value: 'eu_sales_team' },
  },
];
