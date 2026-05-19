// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Page } from '@objectstack/spec/ui';
import { P } from '@objectstack/spec';

/**
 * Opportunity Detail Record Page
 *
 * Salesforce Lightning-style record page for the `opportunity` object.
 * Demonstrates the Page-as-root model:
 *   PageSchema(type='record') → regions[] → page:* containers → record:* leaves.
 */
export const OpportunityDetailPage: Page = {
  name: 'opportunity_detail_page',
  label: 'Opportunity Detail',
  description: 'Comprehensive opportunity detail page with path, highlights, details, and related lists',

  type: 'record',
  object: 'opportunity',

  template: 'header-sidebar-main',

  variables: [
    { name: 'activeTab', type: 'string', defaultValue: 'details' },
  ],

  regions: [
    {
      name: 'header',
      width: 'full',
      components: [
        {
          type: 'page:header',
          id: 'opp_header',
          label: 'Opportunity Information',
          properties: {
            title: '{name}',
            subtitle: '{account}',
            icon: 'briefcase',
            breadcrumb: true,
            actions: ['edit', 'delete', 'clone', 'share'],
          },
        },
        {
          type: 'record:path',
          id: 'opp_stage_path',
          label: 'Opportunity Stage Path',
          properties: {
            statusField: 'stage',
            stages: [
              { value: 'prospecting', label: 'Prospecting' },
              { value: 'qualification', label: 'Qualification' },
              { value: 'proposal', label: 'Proposal' },
              { value: 'negotiation', label: 'Negotiation' },
              { value: 'closed_won', label: 'Closed Won' },
              { value: 'closed_lost', label: 'Closed Lost' },
            ],
          },
        },
      ],
    },
    {
      name: 'sidebar',
      width: 'medium',
      components: [
        {
          type: 'record:highlights',
          id: 'opp_highlights',
          label: 'Key Information',
          properties: {
            fields: ['amount', 'close_date', 'probability', 'expected_revenue', 'owner', 'account'],
            layout: 'vertical',
          },
        },
        {
          type: 'page:card',
          id: 'opp_quick_actions',
          label: 'Quick Actions',
          properties: {
            title: 'Quick Actions',
            bordered: true,
            actions: ['log_call', 'create_task', 'schedule_meeting', 'send_email'],
          },
        },
        {
          type: 'ai:chat_window',
          id: 'opp_ai_assistant',
          label: 'AI Assistant',
          properties: {
            mode: 'sidebar',
            agentId: 'sales_assistant',
            context: { recordType: 'opportunity', recordId: '{record.id}' },
          },
          visibility: P`record.stage == "negotiation" || record.stage == "proposal"`,
        },
      ],
    },
  ],

  isDefault: true,
  assignedProfiles: ['sales_user', 'sales_manager', 'system_administrator'],

  aria: {
    ariaLabel: 'Opportunity Detail Page',
    ariaDescribedBy: 'Detailed view of opportunity information with related records and activity',
  },
};
