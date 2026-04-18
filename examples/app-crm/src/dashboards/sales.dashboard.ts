// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Dashboard } from '@objectstack/spec/ui';

/**
 * Sales Performance Dashboard
 *
 * Pipeline analytics, win rate trends, and rep performance for the sales team.
 * Modeled after the polished CRM dashboard reference at
 * https://github.com/objectstack-ai/objectui/tree/main/examples/crm.
 */
export const SalesDashboard: Dashboard = {
  name: 'sales_dashboard',
  label: 'Sales Performance',
  description: 'Pipeline analytics, win rate trends, and rep performance',

  refreshInterval: 180, // 3 minutes

  header: {
    showTitle: true,
    showDescription: true,
    actions: [
      { label: 'New Opportunity', icon: 'Plus',     actionType: 'modal', actionUrl: 'create_opportunity' },
      { label: 'Forecast',        icon: 'TrendingUp', actionType: 'url', actionUrl: '/reports/forecast' },
      { label: 'Export',          icon: 'Download', actionType: 'script', actionUrl: 'export_dashboard_pdf' },
    ],
  },

  dateRange: {
    field: 'close_date',
    defaultRange: 'this_quarter',
    allowCustomRange: true,
  },

  globalFilters: [
    {
      field: 'owner',
      label: 'Sales Rep',
      type: 'lookup',
      scope: 'dashboard',
      optionsFrom: { object: 'user', valueField: 'id', labelField: 'name' },
    },
    {
      field: 'type',
      label: 'Deal Type',
      type: 'select',
      scope: 'dashboard',
      options: [
        { value: 'new_business',     label: 'New Business' },
        { value: 'existing_business', label: 'Existing Business' },
        { value: 'renewal',          label: 'Renewal' },
      ],
    },
  ],

  widgets: [
    // ─── Row 1: Pipeline KPIs ─────────────────────────────────────────
    {
      id: 'total_pipeline_value',
      title: 'Total Pipeline',
      description: 'Sum of open opportunity value',
      type: 'metric',
      object: 'opportunity',
      filter: { stage: { $nin: ['closed_won', 'closed_lost'] } },
      valueField: 'amount',
      aggregate: 'sum',
      colorVariant: 'blue',
      actionUrl: '/objects/opportunity?filter=open',
      actionType: 'url',
      actionIcon: 'ArrowUpRight',
      layout: { x: 0, y: 0, w: 3, h: 2 },
      options: {
        icon: 'DollarSign',
        format: '$0,0',
        prefix: '$',
        trend: { value: 8.4, direction: 'up', label: 'vs last quarter' },
      },
    },
    {
      id: 'closed_won_qtd',
      title: 'Closed Won (QTD)',
      description: 'Revenue closed this quarter',
      type: 'metric',
      object: 'opportunity',
      filter: { stage: 'closed_won', close_date: { $gte: '{current_quarter_start}' } },
      valueField: 'amount',
      aggregate: 'sum',
      colorVariant: 'success',
      actionUrl: '/reports/closed-won',
      actionType: 'url',
      actionIcon: 'ArrowUpRight',
      layout: { x: 3, y: 0, w: 3, h: 2 },
      options: {
        icon: 'Trophy',
        format: '$0,0',
        prefix: '$',
        trend: { value: 14.7, direction: 'up', label: 'vs last quarter' },
      },
    },
    {
      id: 'open_opportunities',
      title: 'Open Opportunities',
      description: 'Active deals in flight',
      type: 'metric',
      object: 'opportunity',
      filter: { stage: { $nin: ['closed_won', 'closed_lost'] } },
      aggregate: 'count',
      colorVariant: 'orange',
      actionUrl: '/objects/opportunity?filter=open',
      actionType: 'url',
      actionIcon: 'ArrowUpRight',
      layout: { x: 6, y: 0, w: 3, h: 2 },
      options: {
        icon: 'Briefcase',
        format: '0,0',
        trend: { value: 2.1, direction: 'down', label: 'vs last quarter' },
      },
    },
    {
      id: 'avg_deal_size',
      title: 'Avg Deal Size',
      description: 'Average value of closed-won deals this quarter',
      type: 'metric',
      object: 'opportunity',
      filter: { stage: 'closed_won', close_date: { $gte: '{current_quarter_start}' } },
      valueField: 'amount',
      aggregate: 'avg',
      colorVariant: 'purple',
      actionUrl: '/reports/avg-deal-size',
      actionType: 'url',
      actionIcon: 'ArrowUpRight',
      layout: { x: 9, y: 0, w: 3, h: 2 },
      options: {
        icon: 'BarChart3',
        format: '$0,0',
        prefix: '$',
        trend: { value: 4.3, direction: 'up', label: 'vs last quarter' },
      },
    },

    // ─── Row 2: Pipeline & Trends ─────────────────────────────────────
    {
      id: 'pipeline_by_stage',
      title: 'Pipeline by Stage',
      description: 'Open opportunity value at each sales stage',
      type: 'funnel',
      object: 'opportunity',
      filter: { stage: { $nin: ['closed_won', 'closed_lost'] } },
      categoryField: 'stage',
      valueField: 'amount',
      aggregate: 'sum',
      colorVariant: 'teal',
      layout: { x: 0, y: 2, w: 6, h: 4 },
      chartConfig: {
        type: 'funnel',
        showLegend: false,
        showDataLabels: true,
        colors: ['#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', '#22C55E'],
      },
    },
    {
      id: 'monthly_revenue_trend',
      title: 'Monthly Revenue Trend',
      description: 'Closed-won revenue, last 12 months',
      type: 'area',
      object: 'opportunity',
      filter: { stage: 'closed_won', close_date: { $gte: '{last_12_months}' } },
      categoryField: 'close_date',
      valueField: 'amount',
      aggregate: 'sum',
      colorVariant: 'success',
      layout: { x: 6, y: 2, w: 6, h: 4 },
      chartConfig: {
        type: 'area',
        showLegend: false,
        showDataLabels: false,
        colors: ['#10B981'],
        xAxis: { field: 'close_date', title: 'Month', showGridLines: false },
        yAxis: [{ field: 'amount', title: 'Revenue', format: '$0,0', showGridLines: true }],
        annotations: [
          { type: 'line', axis: 'y', value: 100000, label: 'Quota', style: 'dashed', color: '#F59E0B' },
        ],
        interaction: { tooltips: true, brush: true },
      },
      options: { dateGranularity: 'month' },
    },

    // ─── Row 3: Performance Breakdown ─────────────────────────────────
    {
      id: 'opportunities_by_owner',
      title: 'Opportunities by Owner',
      description: 'Open pipeline value per sales rep',
      type: 'horizontal-bar',
      object: 'opportunity',
      filter: { stage: { $nin: ['closed_won', 'closed_lost'] } },
      categoryField: 'owner',
      valueField: 'amount',
      aggregate: 'sum',
      colorVariant: 'blue',
      layout: { x: 0, y: 6, w: 6, h: 4 },
      chartConfig: {
        type: 'horizontal-bar',
        showLegend: false,
        showDataLabels: true,
        colors: ['#4F46E5'],
        xAxis: { field: 'amount', title: 'Pipeline value', format: '$0,0', showGridLines: true },
        yAxis: [{ field: 'owner', title: 'Owner', showGridLines: false }],
      },
    },
    {
      id: 'lead_source_breakdown',
      title: 'Lead Source',
      description: 'Where our pipeline is coming from',
      type: 'donut',
      object: 'opportunity',
      filter: { stage: { $nin: ['closed_lost'] } },
      categoryField: 'lead_source',
      valueField: 'amount',
      aggregate: 'sum',
      colorVariant: 'purple',
      layout: { x: 6, y: 6, w: 6, h: 4 },
      chartConfig: {
        type: 'donut',
        showLegend: true,
        showDataLabels: true,
        colors: ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
      },
    },

    // ─── Row 4: Top Deals ─────────────────────────────────────────────
    {
      id: 'top_opportunities',
      title: 'Top Open Opportunities',
      description: 'Highest-value deals still in flight',
      type: 'table',
      object: 'opportunity',
      filter: { stage: { $nin: ['closed_won', 'closed_lost'] } },
      aggregate: 'count',
      colorVariant: 'default',
      layout: { x: 0, y: 10, w: 12, h: 4 },
      options: {
        columns: [
          { header: 'Opportunity', accessorKey: 'name' },
          { header: 'Account',     accessorKey: 'account' },
          { header: 'Amount',      accessorKey: 'amount', format: '$0,0' },
          { header: 'Stage',       accessorKey: 'stage' },
          { header: 'Probability', accessorKey: 'probability', format: '0%' },
          { header: 'Close Date',  accessorKey: 'close_date', format: 'MMM D, YYYY' },
          { header: 'Owner',       accessorKey: 'owner' },
        ],
        sortBy: 'amount',
        sortOrder: 'desc',
        limit: 10,
        striped: true,
        density: 'comfortable',
      },
    },
  ],
};
