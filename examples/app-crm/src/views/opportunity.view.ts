// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec/ui';

/**
 * Opportunity Views
 *
 * Sales pipeline benefits from multiple visualisations:
 *   • grid     — full pipeline browsing & inline edits
 *   • kanban   — drag-and-drop pipeline stage management (group by stage)
 *   • calendar — close-date forecasting on a monthly view
 *   • timeline — chronological deal flow grouped by owner
 *   • gallery  — pinboard / executive review cards
 */
export const OpportunityViews = defineView({
  list: {
    type: 'grid',
    name: 'all_opportunities',
    label: 'All Opportunities',
    data: { provider: 'object', object: 'opportunity' },
    columns: [
      { field: 'name', width: 220, sortable: true, link: true },
      { field: 'account', label: 'Account', width: 180 },
      { field: 'stage', width: 140, sortable: true },
      { field: 'amount', width: 140, align: 'right', sortable: true, summary: 'sum' },
      { field: 'probability', width: 110, align: 'right' },
      { field: 'expected_revenue', width: 160, align: 'right', summary: 'sum' },
      { field: 'close_date', width: 140, sortable: true },
      { field: 'owner', width: 150 },
    ],
    sort: [{ field: 'close_date', order: 'asc' }],
    grouping: { fields: [{ field: 'stage', order: 'asc', collapsed: false }] },
    rowColor: {
      field: 'stage',
      colors: {
        prospecting: '#94a3b8',
        qualification: '#60a5fa',
        proposal: '#f59e0b',
        negotiation: '#a855f7',
        closed_won: '#16a34a',
        closed_lost: '#dc2626',
      },
    },
    pagination: { pageSize: 25, pageSizeOptions: [25, 50, 100] },
    selection: { type: 'multiple' },
    showRecordCount: true,
    exportOptions: ['csv', 'xlsx'],
    appearance: {
      showDescription: true,
      allowedVisualizations: ['grid', 'kanban', 'calendar', 'timeline', 'gallery'],
    },
    tabs: [
      { name: 'all', label: 'All', view: 'all_opportunities', isDefault: true, pinned: true },
      { name: 'pipeline', label: 'Pipeline', icon: 'columns-3', view: 'pipeline_kanban' },
      { name: 'forecast', label: 'Forecast', icon: 'calendar', view: 'close_date_calendar' },
      { name: 'timeline', label: 'Timeline', icon: 'git-commit-horizontal', view: 'deal_timeline' },
      { name: 'cards', label: 'Cards', icon: 'gallery-thumbnails', view: 'deal_gallery' },
      { name: 'mine', label: 'My Deals', icon: 'user', view: 'my_open_deals' },
    ],
  },

  listViews: {
    /** Drag-and-drop sales pipeline */
    pipeline_kanban: {
      name: 'pipeline_kanban',
      type: 'kanban',
      label: 'Sales Pipeline',
      data: { provider: 'object', object: 'opportunity' },
      columns: ['name', 'account', 'amount', 'close_date', 'owner'],
      kanban: {
        groupByField: 'stage',
        summarizeField: 'amount',
        columns: ['name', 'account', 'amount', 'close_date'],
      },
      filter: [{ field: 'stage', operator: 'not_equals', value: 'closed_lost' }],
      navigation: { mode: 'drawer', width: '640px' },
    },

    /** Close-date forecasting calendar */
    close_date_calendar: {
      name: 'close_date_calendar',
      type: 'calendar',
      label: 'Forecast Calendar',
      data: { provider: 'object', object: 'opportunity' },
      columns: ['name', 'amount', 'stage', 'owner'],
      calendar: {
        startDateField: 'close_date',
        titleField: 'name',
        colorField: 'stage',
      },
    },

    /** Chronological deal flow */
    deal_timeline: {
      name: 'deal_timeline',
      type: 'timeline',
      label: 'Deal Timeline',
      data: { provider: 'object', object: 'opportunity' },
      columns: ['name', 'account', 'amount'],
      timeline: {
        startDateField: 'created_date',
        endDateField: 'close_date',
        titleField: 'name',
        groupByField: 'owner',
        colorField: 'stage',
        scale: 'month',
      },
    },

    /** Executive review cards */
    deal_gallery: {
      name: 'deal_gallery',
      type: 'gallery',
      label: 'Deal Cards',
      data: { provider: 'object', object: 'opportunity' },
      columns: ['name', 'account', 'amount', 'stage', 'close_date'],
      gallery: {
        cardSize: 'medium',
        titleField: 'name',
        visibleFields: ['account', 'amount', 'stage', 'probability', 'close_date', 'owner'],
      },
    },

    /** Personal pipeline */
    my_open_deals: {
      name: 'my_open_deals',
      type: 'grid',
      label: 'My Open Deals',
      data: { provider: 'object', object: 'opportunity' },
      columns: ['name', 'account', 'stage', 'amount', 'close_date'],
      filter: [
        { field: 'owner', operator: 'equals', value: '{current_user_id}' },
        { field: 'stage', operator: 'not_equals', value: 'closed_won' },
      ],
      sort: [{ field: 'close_date', order: 'asc' }],
    },

    /** Stale Opportunities — no activity for 30+ days, still open */
    stale_opportunities: {
      name: 'stale_opportunities',
      type: 'grid',
      label: '⚠️ Stale Opportunities',
      data: { provider: 'object', object: 'opportunity' },
      columns: ['name', 'account', 'stage', 'amount', 'days_in_stage', 'close_date', 'owner'],
      filter: [
        { field: 'days_in_stage', operator: 'greater_than', value: 30 },
        { field: 'stage', operator: 'not_in', value: ['closed_won', 'closed_lost'] },
      ],
      sort: [{ field: 'days_in_stage', order: 'desc' }],
    },

    /** Closing this quarter (commit + best_case) — sales-manager forecast */
    closing_this_quarter: {
      name: 'closing_this_quarter',
      type: 'grid',
      label: 'Closing This Quarter',
      data: { provider: 'object', object: 'opportunity' },
      columns: ['name', 'account', 'amount', 'forecast_category', 'probability', 'close_date', 'owner'],
      filter: [
        { field: 'forecast_category', operator: 'in', value: ['commit', 'best_case'] },
        { field: 'stage', operator: 'not_in', value: ['closed_won', 'closed_lost'] },
      ],
      sort: [{ field: 'close_date', order: 'asc' }],
    },
  },

  form: {
    type: 'tabbed',
    data: { provider: 'object', object: 'opportunity' },
    sections: [
      {
        label: 'Overview',
        columns: 2,
        fields: [
          { field: 'name', required: true, colSpan: 2 },
          { field: 'account', required: true },
          'primary_contact',
          { field: 'stage', required: true },
          { field: 'amount', required: true },
          'probability',
          'close_date',
          'owner',
        ],
      },
      {
        label: 'Forecast',
        columns: 2,
        fields: [
          'expected_revenue',
          'forecast_category',
          'lead_source',
          'campaign',
          'days_in_stage',
          'is_private',
        ],
      },
      {
        label: 'Sales Strategy',
        columns: 1,
        fields: ['next_step', 'competitors'],
      },
    ],
  },
});
