// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Dashboard } from '@objectstack/spec/ui';

/**
 * Customer Service Dashboard
 *
 * Case load, SLA health, and resolution performance for the support team.
 * Uses semantic colorVariant tokens (warning/danger/success) and chartConfig
 * palettes instead of raw hex values, mirroring the polished CRM dashboard
 * reference at https://github.com/objectstack-ai/objectui/tree/main/examples/crm.
 */
export const ServiceDashboard: Dashboard = {
  name: 'service_dashboard',
  label: 'Customer Service',
  description: 'Case load, SLA health, and resolution performance',

  columns: 12,
  gap: 4,
  refreshInterval: 60, // 1 minute — service desks need fresh numbers

  header: {
    showTitle: true,
    showDescription: true,
    actions: [
      { label: 'New Case',     icon: 'Plus',     actionType: 'modal',  actionUrl: 'create_case' },
      { label: 'My Queue',     icon: 'Inbox',    actionType: 'url',    actionUrl: '/objects/case?owner=current_user' },
      { label: 'SLA Report',   icon: 'BarChart3', actionType: 'url',   actionUrl: '/reports/sla' },
    ],
  },

  dateRange: {
    field: 'created_date',
    defaultRange: 'last_30_days',
    allowCustomRange: true,
  },

  globalFilters: [
    {
      field: 'owner',
      label: 'Agent',
      type: 'lookup',
      scope: 'dashboard',
      optionsFrom: { object: 'user', valueField: 'id', labelField: 'name' },
    },
    {
      field: 'priority',
      label: 'Priority',
      type: 'select',
      scope: 'dashboard',
      options: [
        { value: 'critical', label: 'Critical' },
        { value: 'high',     label: 'High' },
        { value: 'medium',   label: 'Medium' },
        { value: 'low',      label: 'Low' },
      ],
    },
  ],

  widgets: [
    // ─── Row 1: Case-Load KPIs ────────────────────────────────────────
    {
      id: 'open_cases',
      title: 'Open Cases',
      description: 'Cases that are not yet closed',
      type: 'metric',
      object: 'case',
      filter: { is_closed: false },
      aggregate: 'count',
      colorVariant: 'orange',
      actionUrl: '/objects/case?filter=open',
      actionType: 'url',
      actionIcon: 'ArrowUpRight',
      layout: { x: 0, y: 0, w: 3, h: 2 },
      options: {
        icon: 'Inbox',
        format: '0,0',
        trend: { value: 6.2, direction: 'down', label: 'vs last week' },
      },
    },
    {
      id: 'critical_cases',
      title: 'Critical Cases',
      description: 'Open cases marked as critical priority',
      type: 'metric',
      object: 'case',
      filter: { priority: 'critical', is_closed: false },
      aggregate: 'count',
      colorVariant: 'danger',
      actionUrl: '/objects/case?priority=critical',
      actionType: 'url',
      actionIcon: 'ArrowUpRight',
      layout: { x: 3, y: 0, w: 3, h: 2 },
      options: {
        icon: 'AlertTriangle',
        format: '0,0',
        trend: { value: 1.0, direction: 'up', label: 'vs last week' },
      },
    },
    {
      id: 'avg_resolution_time',
      title: 'Avg Resolution Time',
      description: 'Mean time to close, in hours',
      type: 'metric',
      object: 'case',
      filter: { is_closed: true },
      valueField: 'resolution_time_hours',
      aggregate: 'avg',
      colorVariant: 'blue',
      actionUrl: '/reports/resolution-time',
      actionType: 'url',
      actionIcon: 'ArrowUpRight',
      layout: { x: 6, y: 0, w: 3, h: 2 },
      options: {
        icon: 'Clock',
        format: '0.0',
        suffix: 'h',
        trend: { value: 9.8, direction: 'down', label: 'vs last week' },
      },
    },
    {
      id: 'sla_violations',
      title: 'SLA Violations',
      description: 'Cases that breached their SLA',
      type: 'metric',
      object: 'case',
      filter: { is_sla_violated: true },
      aggregate: 'count',
      colorVariant: 'warning',
      actionUrl: '/objects/case?filter=sla_violated',
      actionType: 'url',
      actionIcon: 'ArrowUpRight',
      layout: { x: 9, y: 0, w: 3, h: 2 },
      options: {
        icon: 'ShieldAlert',
        format: '0,0',
        trend: { value: 2.4, direction: 'down', label: 'vs last week' },
      },
    },

    // ─── Row 2: Distribution ──────────────────────────────────────────
    {
      id: 'cases_by_status',
      title: 'Cases by Status',
      description: 'Workload distribution across the pipeline',
      type: 'donut',
      object: 'case',
      filter: { is_closed: false },
      categoryField: 'status',
      aggregate: 'count',
      colorVariant: 'blue',
      layout: { x: 0, y: 2, w: 4, h: 4 },
      chartConfig: {
        type: 'donut',
        showLegend: true,
        showDataLabels: true,
        colors: ['#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', '#F59E0B'],
      },
    },
    {
      id: 'cases_by_priority',
      title: 'Cases by Priority',
      description: 'Open case mix by urgency',
      type: 'pie',
      object: 'case',
      filter: { is_closed: false },
      categoryField: 'priority',
      aggregate: 'count',
      colorVariant: 'warning',
      layout: { x: 4, y: 2, w: 4, h: 4 },
      chartConfig: {
        type: 'pie',
        showLegend: true,
        showDataLabels: true,
        // critical → high → medium → low
        colors: ['#DC2626', '#F97316', '#F59E0B', '#10B981'],
      },
    },
    {
      id: 'cases_by_origin',
      title: 'Cases by Origin',
      description: 'Where our cases are coming from',
      type: 'bar',
      object: 'case',
      categoryField: 'origin',
      aggregate: 'count',
      colorVariant: 'purple',
      layout: { x: 8, y: 2, w: 4, h: 4 },
      chartConfig: {
        type: 'bar',
        showLegend: false,
        showDataLabels: true,
        colors: ['#8B5CF6'],
        xAxis: { field: 'origin', title: 'Channel', showGridLines: false, logarithmic: false },
        yAxis: [{ field: 'count', title: 'Cases', showGridLines: true, logarithmic: false }],
      },
    },

    // ─── Row 3: Volume & SLA Trends ───────────────────────────────────
    {
      id: 'daily_case_volume',
      title: 'Daily Case Volume',
      description: 'New cases created over the last 30 days',
      type: 'area',
      object: 'case',
      filter: { created_date: { $gte: '{last_30_days}' } },
      categoryField: 'created_date',
      aggregate: 'count',
      colorVariant: 'blue',
      layout: { x: 0, y: 6, w: 8, h: 4 },
      chartConfig: {
        type: 'area',
        showLegend: false,
        showDataLabels: false,
        colors: ['#0EA5E9'],
        xAxis: { field: 'created_date', title: 'Day', showGridLines: false, logarithmic: false },
        yAxis: [{ field: 'count', title: 'Cases opened', showGridLines: true, logarithmic: false }],
        interaction: { tooltips: true, brush: true, zoom: false },
      },
      options: { dateGranularity: 'day' },
    },
    {
      id: 'sla_compliance_gauge',
      title: 'SLA Compliance',
      description: 'Percent of cases resolved within SLA this period',
      type: 'gauge',
      object: 'case',
      filter: { is_closed: true },
      valueField: 'is_sla_violated',
      aggregate: 'avg',
      colorVariant: 'success',
      layout: { x: 8, y: 6, w: 4, h: 4 },
      chartConfig: {
        type: 'gauge',
        showLegend: false,
        showDataLabels: true,
        colors: ['#10B981', '#F59E0B', '#EF4444'],
        annotations: [
          { type: 'line', axis: 'y', value: 0.95, label: 'Target', style: 'dashed', color: '#10B981' },
        ],
      },
      options: {
        format: '0%',
        invert: true, // value is sla_violated rate; gauge shows compliance = 1 - rate
        thresholds: [
          { value: 0.95, color: 'success' },
          { value: 0.85, color: 'warning' },
          { value: 0,    color: 'danger' },
        ],
      },
    },

    // ─── Row 4: Personal Queue ────────────────────────────────────────
    {
      id: 'my_open_cases',
      title: 'My Open Cases',
      description: 'Cases assigned to you, sorted by priority',
      type: 'table',
      object: 'case',
      filter: { owner: '{current_user}', is_closed: false },
      aggregate: 'count',
      colorVariant: 'default',
      layout: { x: 0, y: 10, w: 12, h: 4 },
      options: {
        columns: [
          { header: 'Case #',     accessorKey: 'case_number' },
          { header: 'Subject',    accessorKey: 'subject' },
          { header: 'Account',    accessorKey: 'account' },
          { header: 'Priority',   accessorKey: 'priority' },
          { header: 'Status',     accessorKey: 'status' },
          { header: 'Created',    accessorKey: 'created_date', format: 'MMM D, h:mm A' },
        ],
        sortBy: 'priority',
        sortOrder: 'desc',
        limit: 10,
        striped: true,
        density: 'comfortable',
      },
    },
  ],
};
