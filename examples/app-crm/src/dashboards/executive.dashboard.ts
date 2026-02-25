// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Dashboard } from '@objectstack/spec/ui';

export const ExecutiveDashboard: Dashboard = {
  name: 'executive_dashboard',
  label: 'Executive Overview',
  description: 'High-level business metrics',
  
  widgets: [
    // Row 1: Revenue Metrics
    {
      id: 'total_revenue_ytd',
      title: 'Total Revenue (YTD)',
      type: 'metric',
      object: 'opportunity',
      filter: { stage: 'closed_won', close_date: { $gte: '{current_year_start}' } },
      valueField: 'amount',
      aggregate: 'sum',
      layout: { x: 0, y: 0, w: 3, h: 2 },
      options: { prefix: '$', color: '#00AA00' }
    },
    {
      id: 'total_accounts',
      title: 'Total Accounts',
      type: 'metric',
      object: 'account',
      filter: { is_active: true },
      aggregate: 'count',
      layout: { x: 3, y: 0, w: 3, h: 2 },
      options: { color: '#4169E1' }
    },
    {
      id: 'total_contacts',
      title: 'Total Contacts',
      type: 'metric',
      object: 'contact',
      aggregate: 'count',
      layout: { x: 6, y: 0, w: 3, h: 2 },
      options: { color: '#9370DB' }
    },
    {
      id: 'total_leads',
      title: 'Total Leads',
      type: 'metric',
      object: 'lead',
      filter: { is_converted: false },
      aggregate: 'count',
      layout: { x: 9, y: 0, w: 3, h: 2 },
      options: { color: '#FFA500' }
    },
    
    // Row 2: Revenue Analysis
    {
      id: 'revenue_by_industry',
      title: 'Revenue by Industry',
      type: 'bar',
      object: 'opportunity',
      filter: { stage: 'closed_won', close_date: { $gte: '{current_year_start}' } },
      categoryField: 'account.industry',
      valueField: 'amount',
      aggregate: 'sum',
      layout: { x: 0, y: 2, w: 6, h: 4 },
    },
    {
      id: 'quarterly_revenue_trend',
      title: 'Quarterly Revenue Trend',
      type: 'line',
      object: 'opportunity',
      filter: { stage: 'closed_won', close_date: { $gte: '{last_4_quarters}' } },
      categoryField: 'close_date',
      valueField: 'amount',
      aggregate: 'sum',
      layout: { x: 6, y: 2, w: 6, h: 4 },
      options: { dateGranularity: 'quarter' }
    },
    
    // Row 3: Customer & Activity Metrics
    {
      id: 'new_accounts_by_month',
      title: 'New Accounts by Month',
      type: 'bar',
      object: 'account',
      filter: { created_date: { $gte: '{last_6_months}' } },
      categoryField: 'created_date',
      aggregate: 'count',
      layout: { x: 0, y: 6, w: 4, h: 4 },
      options: { dateGranularity: 'month' }
    },
    {
      id: 'lead_conversion_rate',
      title: 'Lead Conversion Rate',
      type: 'metric',
      object: 'lead',
      valueField: 'is_converted',
      aggregate: 'avg',
      layout: { x: 4, y: 6, w: 4, h: 4 },
      options: { suffix: '%', color: '#00AA00' }
    },
    {
      id: 'top_accounts_by_revenue',
      title: 'Top Accounts by Revenue',
      type: 'table',
      object: 'account',
      aggregate: 'count',
      layout: { x: 8, y: 6, w: 4, h: 4 },
      options: {
        columns: ['name', 'annual_revenue', 'type'],
        sortBy: 'annual_revenue',
        sortOrder: 'desc',
        limit: 10,
      }
    },
  ]
};
