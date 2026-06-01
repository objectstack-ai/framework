// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * Account — a customer org. Lookup target for projects and the field zoo.
 */
export const Account = ObjectSchema.create({
  name: 'showcase_account',
  label: 'Account',
  pluralLabel: 'Accounts',
  icon: 'building',
  description: 'A company the org delivers projects for.',

  fields: {
    name: Field.text({ label: 'Account Name', required: true, searchable: true, maxLength: 200 }),
    industry: Field.select({
      label: 'Industry',
      options: [
        { label: 'Technology', value: 'technology', default: true },
        { label: 'Finance', value: 'finance' },
        { label: 'Healthcare', value: 'healthcare' },
        { label: 'Retail', value: 'retail' },
      ],
    }),
    annual_revenue: Field.currency({ label: 'Annual Revenue', scale: 2, min: 0 }),
    website: Field.url({ label: 'Website' }),
    hq: Field.location({ label: 'Headquarters' }),
    status: Field.select({
      label: 'Lifecycle',
      required: true,
      options: [
        { label: 'Prospect', value: 'prospect', default: true, color: '#94A3B8' },
        { label: 'Active', value: 'active', color: '#10B981' },
        { label: 'Churned', value: 'churned', color: '#EF4444' },
      ],
    }),
  },

  // A third `state_machine` example with a different topology than
  // Task/Project: a re-entrant lifecycle (a churned account can be won
  // back). Demonstrates the guardrail is just a per-field validation rule
  // on the object — no separate metadata type, no separate file.
  validations: [
    {
      type: 'state_machine' as const,
      name: 'account_lifecycle',
      label: 'Account Lifecycle',
      description: 'Accounts move prospect → active → churned, and can be reactivated.',
      field: 'status',
      // Transitions are validated on update; insert sets the initial state.
      events: ['update'] as const,
      message: 'Invalid account lifecycle transition.',
      transitions: {
        prospect: ['active', 'churned'],
        active: ['churned'],
        churned: ['active'],
      },
    },
  ],
});
