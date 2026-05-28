// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';
import { cel } from '@objectstack/spec';

export const Opportunity = ObjectSchema.create({
  name: 'crm_opportunity',
  label: 'Opportunity',
  pluralLabel: 'Opportunities',
  icon: 'trending-up',
  description: 'A potential sale tied to an account.',

  fields: {
    name: Field.text({
      label: 'Opportunity Name',
      required: true,
      searchable: true,
      maxLength: 200,
    }),
    account: Field.lookup('crm_account', {
      label: 'Account',
      required: true,
    }),
    stage: Field.select({
      label: 'Stage',
      required: true,
      options: [
        { label: 'Prospecting', value: 'prospecting', default: true, color: '#94A3B8' },
        { label: 'Qualification', value: 'qualification', color: '#3B82F6' },
        { label: 'Proposal', value: 'proposal', color: '#F59E0B' },
        { label: 'Closed Won', value: 'closed_won', color: '#10B981' },
        { label: 'Closed Lost', value: 'closed_lost', color: '#EF4444' },
      ],
    }),
    amount: Field.currency({
      label: 'Amount',
      scale: 2,
      min: 0,
    }),
    probability: Field.percent({
      label: 'Probability',
      defaultValue: 50,
      min: 0,
      max: 100,
    }),
    expected_revenue: Field.formula({
      label: 'Expected Revenue',
      expression: cel`(amount == null ? 0 : amount) * (probability == null ? 0 : probability) / 100`,
    }),
    close_date: Field.date({
      label: 'Close Date',
    }),
    discount_percent: Field.percent({
      label: 'Discount %',
      defaultValue: 0,
      min: 0,
      max: 100,
    }),
    renewal_of: Field.lookup('crm_opportunity', {
      label: 'Renewal Of',
    }),
  },
});
