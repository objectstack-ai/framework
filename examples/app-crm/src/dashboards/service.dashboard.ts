// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Dashboard } from '@objectstack/spec/ui';

export const ServiceDashboard: Dashboard = {
  name: 'service_dashboard',
  label: 'Customer Service',
  description: 'Support case metrics and performance',
  
  widgets: [
    // Row 1: Key Metrics
    {
      id: 'open_cases',
      title: 'Open Cases',
      type: 'metric',
      object: 'case',
      filter: { is_closed: false },
      aggregate: 'count',
      layout: { x: 0, y: 0, w: 3, h: 2 },
      options: { color: '#FFA500' }
    },
    {
      id: 'critical_cases',
      title: 'Critical Cases',
      type: 'metric',
      object: 'case',
      filter: { priority: 'critical', is_closed: false },
      aggregate: 'count',
      layout: { x: 3, y: 0, w: 3, h: 2 },
      options: { color: '#FF0000' }
    },
    {
      id: 'avg_resolution_time',
      title: 'Avg Resolution Time (hrs)',
      type: 'metric',
      object: 'case',
      filter: { is_closed: true },
      valueField: 'resolution_time_hours',
      aggregate: 'avg',
      layout: { x: 6, y: 0, w: 3, h: 2 },
      options: { suffix: 'h', color: '#4169E1' }
    },
    {
      id: 'sla_violations',
      title: 'SLA Violations',
      type: 'metric',
      object: 'case',
      filter: { is_sla_violated: true },
      aggregate: 'count',
      layout: { x: 9, y: 0, w: 3, h: 2 },
      options: { color: '#FF4500' }
    },
    
    // Row 2: Case Distribution
    {
      id: 'cases_by_status',
      title: 'Cases by Status',
      type: 'pie',
      object: 'case',
      filter: { is_closed: false },
      categoryField: 'status',
      aggregate: 'count',
      layout: { x: 0, y: 2, w: 4, h: 4 },
      options: { showLegend: true }
    },
    {
      id: 'cases_by_priority',
      title: 'Cases by Priority',
      type: 'pie',
      object: 'case',
      filter: { is_closed: false },
      categoryField: 'priority',
      aggregate: 'count',
      layout: { x: 4, y: 2, w: 4, h: 4 },
      options: { showLegend: true }
    },
    {
      id: 'cases_by_origin',
      title: 'Cases by Origin',
      type: 'bar',
      object: 'case',
      categoryField: 'origin',
      aggregate: 'count',
      layout: { x: 8, y: 2, w: 4, h: 4 },
    },
    
    // Row 3: Trends and Lists
    {
      id: 'daily_case_volume',
      title: 'Daily Case Volume',
      type: 'line',
      object: 'case',
      filter: { created_date: { $gte: '{last_30_days}' } },
      categoryField: 'created_date',
      aggregate: 'count',
      layout: { x: 0, y: 6, w: 8, h: 4 },
      options: { dateGranularity: 'day' }
    },
    {
      id: 'my_open_cases',
      title: 'My Open Cases',
      type: 'table',
      object: 'case',
      filter: { owner: '{current_user}', is_closed: false },
      aggregate: 'count',
      layout: { x: 8, y: 6, w: 4, h: 4 },
      options: {
        columns: ['case_number', 'subject', 'priority', 'status'],
        sortBy: 'priority',
        sortOrder: 'desc',
        limit: 10,
      }
    },
  ]
};
