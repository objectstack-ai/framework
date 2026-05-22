// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Page } from '@objectstack/spec/ui';
import { CloneOpportunityAction } from '../actions/opportunity.actions';

/**
 * Opportunity Detail Record Page
 *
 * Salesforce Lightning-style record page for the `opportunity` object.
 * Mirrors the lead_detail blueprint: single-column full-width layout with
 * a Lightning-style header chip, primary action, key highlights strip and
 * status path, then a tab strip below. No sidebar — secondary widgets such
 * as the AI assistant live in the floating console chat instead.
 */
export const OpportunityDetailPage: Page = {
  name: 'opportunity_detail_page',
  label: 'Opportunity Detail',
  description: 'Comprehensive opportunity detail page with path, highlights, details, and related lists',

  type: 'record',
  object: 'opportunity',

  template: 'full-width',
  kind: 'full',
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
            actions: [CloneOpportunityAction],
          },
        },
        {
          type: 'record:highlights',
          id: 'opp_highlights',
          label: 'Key Information',
          properties: {
            fields: ['amount', 'close_date', 'probability', 'expected_revenue', 'owner', 'account'],
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
                children: [
                  {
                    type: 'record:details',
                    id: 'opp_details',
                    label: 'Opportunity Details',
                    properties: {
                      columns: 2,
                      layout: 'auto',
                      sections: [
                        {
                          name: 'info',
                          label: 'Opportunity Information',
                          fields: ['name', 'account', 'owner', 'type', 'lead_source', 'campaign'],
                        },
                        {
                          name: 'forecast',
                          label: 'Stage & Forecast',
                          fields: ['stage', 'probability', 'amount', 'expected_revenue', 'close_date', 'forecast_category'],
                        },
                        {
                          name: 'description',
                          label: 'Description',
                          columns: 1,
                          collapsible: true,
                          fields: ['description', 'next_step'],
                        },
                      ],
                    },
                  },
                ],
              },
              {
                key: 'related',
                label: 'Related',
                children: [
                  {
                    type: 'page:accordion',
                    id: 'opp_related_accordion',
                    properties: {
                      items: [
                        {
                          key: 'quotes',
                          label: 'Quotes',
                          children: [
                            {
                              type: 'record:related_list',
                              id: 'opp_quotes',
                              properties: {
                                objectName: 'quote',
                                relationshipField: 'opportunity',
                                columns: ['quote_number', 'name', 'status', 'total_price', 'expiration_date'],
                                limit: 10,
                              },
                            },
                          ],
                        },
                        {
                          key: 'products',
                          label: 'Products',
                          children: [
                            {
                              type: 'record:related_list',
                              id: 'opp_products',
                              properties: {
                                objectName: 'opportunity_line_item',
                                relationshipField: 'opportunity',
                                columns: ['product', 'quantity', 'unit_price', 'total_price'],
                                limit: 10,
                              },
                            },
                          ],
                        },
                        {
                          key: 'tasks',
                          label: 'Open Tasks',
                          children: [
                            {
                              type: 'record:related_list',
                              id: 'opp_tasks',
                              properties: {
                                objectName: 'task',
                                relationshipField: 'related_to_opportunity',
                                columns: ['subject', 'status', 'priority', 'due_date', 'owner'],
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
                children: [
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
      name: 'aside',
      width: 'small',
      className: 'hidden xl:flex flex-col gap-4',
      components: [
        {
          type: 'record:reference_rail',
          id: 'opp_reference_rail',
          properties: {
            entries: [
              {
                objectName: 'quote',
                relationshipField: 'opportunity',
                title: 'Quotes',
                limit: 3,
              },
              {
                objectName: 'opportunity_line_item',
                relationshipField: 'opportunity',
                title: 'Products',
                limit: 3,
              },
              {
                objectName: 'task',
                relationshipField: 'related_to_opportunity',
                title: 'Open Tasks',
                limit: 3,
              },
            ],
          },
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
