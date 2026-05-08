// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec/ui';

/**
 * Campaign Views
 *
 *   • grid     — performance grid with aggregated KPIs
 *   • gantt    — campaign schedule (start_date → end_date)
 *   • calendar — launch calendar
 *   • timeline — multi-campaign chronological view
 */
export const CampaignViews = defineView({
  list: {
    type: 'grid',
    name: 'all_campaigns',
    label: 'All Campaigns',
    data: { provider: 'object', object: 'campaign' },
    columns: [
      { field: 'name', width: 240, sortable: true, link: true, pinned: 'left' },
      { field: 'channel', width: 130 },
      { field: 'status', width: 130, sortable: true },
      { field: 'start_date', width: 130, sortable: true },
      { field: 'end_date', width: 130, sortable: true },
      { field: 'budgeted_cost', width: 140, align: 'right', summary: 'sum' },
      { field: 'actual_cost', width: 140, align: 'right', summary: 'sum' },
      { field: 'expected_revenue', width: 160, align: 'right', summary: 'sum' },
      { field: 'actual_revenue', width: 160, align: 'right', summary: 'sum' },
      { field: 'response_rate', width: 130, align: 'right' },
      { field: 'roi', width: 110, align: 'right' },
      { field: 'owner', width: 150 },
    ],
    sort: [{ field: 'start_date', order: 'desc' }],
    grouping: { fields: [{ field: 'channel', order: 'asc' }] },
    pagination: { pageSize: 25 },
    selection: { type: 'multiple' },
    appearance: {
      showDescription: true,
      allowedVisualizations: ['grid', 'gantt', 'calendar', 'timeline'],
    },
    tabs: [
      { name: 'all', label: 'All', view: 'all_campaigns', isDefault: true, pinned: true },
      { name: 'schedule', label: 'Schedule', icon: 'gantt-chart', view: 'campaign_gantt' },
      { name: 'launches', label: 'Launches', icon: 'calendar', view: 'campaign_calendar' },
      { name: 'timeline', label: 'Timeline', icon: 'git-commit-horizontal', view: 'campaign_timeline' },
    ],
  },

  listViews: {
    /** Campaign schedule */
    campaign_gantt: {
      name: 'campaign_gantt',
      type: 'gantt',
      label: 'Campaign Schedule',
      data: { provider: 'object', object: 'campaign' },
      columns: ['name', 'channel', 'owner'],
      gantt: {
        startDateField: 'start_date',
        endDateField: 'end_date',
        titleField: 'name',
      },
    },

    /** Launch calendar */
    campaign_calendar: {
      name: 'campaign_calendar',
      type: 'calendar',
      label: 'Launch Calendar',
      data: { provider: 'object', object: 'campaign' },
      columns: ['name', 'channel', 'status'],
      calendar: {
        startDateField: 'start_date',
        endDateField: 'end_date',
        titleField: 'name',
        colorField: 'channel',
      },
    },

    /** Marketing timeline */
    campaign_timeline: {
      name: 'campaign_timeline',
      type: 'timeline',
      label: 'Marketing Timeline',
      data: { provider: 'object', object: 'campaign' },
      columns: ['name', 'channel'],
      timeline: {
        startDateField: 'start_date',
        endDateField: 'end_date',
        titleField: 'name',
        groupByField: 'channel',
        colorField: 'status',
        scale: 'month',
      },
    },
  },

  form: {
    type: 'tabbed',
    data: { provider: 'object', object: 'campaign' },
    sections: [
      {
        label: 'Overview',
        columns: 2,
        fields: [
          { field: 'name', required: true, colSpan: 2 },
          'campaign_code',
          'channel',
          { field: 'status', required: true },
          'parent_campaign',
          'owner',
          'is_active',
          'landing_page_url',
        ],
      },
      {
        label: 'Schedule & Budget',
        columns: 2,
        fields: ['start_date', 'end_date', 'budgeted_cost', 'actual_cost', 'expected_revenue', 'actual_revenue', 'target_size'],
      },
      {
        label: 'Performance',
        columns: 2,
        fields: [
          'num_sent',
          'num_responses',
          'num_leads',
          'num_converted_leads',
          'num_opportunities',
          'num_won_opportunities',
          'response_rate',
          'roi',
        ],
      },
    ],
  },
});
