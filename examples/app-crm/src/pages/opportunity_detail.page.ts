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
      name: 'main',
      width: 'large',
      components: [
        {
          type: 'page:tabs',
          id: 'opp_main_tabs',
          properties: {
            type: 'line',
            position: 'top',
            items: [
              {
                key: 'details',
                label: 'Details',
                components: [
                  {
                    type: 'record:details',
                    id: 'opp_details',
                    label: 'Opportunity Details',
                    properties: {
                      sections: [
                        {
                          label: 'Opportunity Information',
                          columns: 2,
                          fields: [
                            { field: 'name', required: true, colSpan: 2 },
                            { field: 'account', required: true },
                            { field: 'owner' },
                            { field: 'stage', required: true },
                            { field: 'probability' },
                            { field: 'amount' },
                            { field: 'close_date', required: true },
                          ],
                        },
                        {
                          label: 'Description',
                          columns: 1,
                          collapsible: true,
                          fields: [
                            { field: 'description', colSpan: 1 },
                            { field: 'next_step', colSpan: 1 },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
              {
                key: 'related',
                label: 'Related',
                components: [
                  {
                    type: 'page:accordion',
                    id: 'opp_related_accordion',
                    properties: {
                      items: [
                        {
                          key: 'quotes',
                          label: 'Quotes',
                          components: [
                            {
                              type: 'record:related_list',
                              id: 'opp_quotes',
                              properties: {
                                objectName: 'opportunity_quote',
                                relationshipField: 'opportunity_id',
                                columns: ['quote_number', 'status', 'total_amount', 'expires_at'],
                                limit: 10,
                              },
                            },
                          ],
                        },
                        {
                          key: 'contacts',
                          label: 'Contacts',
                          components: [
                            {
                              type: 'record:related_list',
                              id: 'opp_contacts',
                              properties: {
                                objectName: 'opportunity_contact',
                                relationshipField: 'opportunity_id',
                                columns: ['name', 'role', 'email', 'phone'],
                                limit: 10,
                              },
                            },
                          ],
                        },
                        {
                          key: 'tasks',
                          label: 'Open Tasks',
                          components: [
                            {
                              type: 'record:related_list',
                              id: 'opp_tasks',
                              properties: {
                                objectName: 'opportunity_task',
                                relationshipField: 'opportunity_id',
                                columns: ['subject', 'status', 'due_date', 'assignee'],
                                filter: [{ field: 'status', op: 'neq', value: 'completed' }],
                                limit: 10,
                              },
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
              {
                key: 'activity',
                label: 'Activity',
                components: [
                  {
                    type: 'record:activity',
                    id: 'opp_activity',
                    properties: {
                      filters: ['all', 'tasks', 'meetings', 'calls', 'emails'],
                      limit: 25,
                    },
                  },
                ],
              },
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
