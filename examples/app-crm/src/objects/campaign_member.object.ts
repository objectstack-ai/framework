// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * Campaign Member Object
 *
 * Links a Lead OR Contact to a Campaign and tracks the response
 * lifecycle (Sent → Opened → Clicked → Responded → Converted).
 * Used by the campaign-enrollment flow and by ROI dashboards.
 */
export const CampaignMember = ObjectSchema.create({
  name: 'campaign_member',
  label: 'Campaign Member',
  pluralLabel: 'Campaign Members',
  icon: 'user-plus',
  description: 'Membership and response tracking for marketing campaigns',

  trackHistory: true,
  shareModel: 'controlled-by-parent',

  compactLayout: ['campaign', 'lead', 'contact', 'status', 'response_date'],

  fieldGroups: [
    { key: 'basic',    label: 'Basic Information', icon: 'info' },
    { key: 'response', label: 'Response Tracking', icon: 'activity' },
  ],

  fields: {
    campaign: Field.lookup('campaign', {
      label: 'Campaign',
      required: true,
      group: 'basic',
    }),

    lead: Field.lookup('lead', {
      label: 'Lead',
      group: 'basic',
      description: 'Set when the member was a Lead at enrollment time',
    }),

    contact: Field.lookup('contact', {
      label: 'Contact',
      group: 'basic',
      description: 'Set when the member is an existing Contact',
    }),

    status: Field.select({
      label: 'Status',
      required: true,
      group: 'response',
      options: [
        { label: 'Sent',      value: 'sent',      default: true, color: '#A0A0A0' },
        { label: 'Opened',    value: 'opened',    color: '#4169E1' },
        { label: 'Clicked',   value: 'clicked',   color: '#00AA00' },
        { label: 'Responded', value: 'responded', color: '#00AA00' },
        { label: 'Converted', value: 'converted', color: '#7C3AED' },
        { label: 'Bounced',   value: 'bounced',   color: '#FF4500' },
        { label: 'Unsubscribed', value: 'unsubscribed', color: '#FF0000' },
      ],
    }),

    added_date: Field.datetime({
      label: 'Added Date',
      readonly: true,
      group: 'response',
    }),

    first_opened_date: Field.datetime({
      label: 'First Opened',
      group: 'response',
    }),

    first_clicked_date: Field.datetime({
      label: 'First Clicked',
      group: 'response',
    }),

    response_date: Field.datetime({
      label: 'Response Date',
      group: 'response',
    }),

    has_responded: Field.boolean({
      label: 'Has Responded',
      defaultValue: false,
      group: 'response',
    }),
  },

  validations: [
    {
      name: 'lead_or_contact_required',
      type: 'script',
      severity: 'error',
      message: 'A campaign member must reference either a Lead or a Contact',
      condition: { dialect: 'cel', source: 'isBlank(record.lead) && isBlank(record.contact)' },
    },
  ],
});
