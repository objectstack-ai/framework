// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ChartConfig, ChartType, Dashboard } from '@objectstack/spec/ui';

const taskDs = 'showcase_task_metrics';
const projectDs = 'showcase_project_metrics';

const cfg = (type: ChartType, dimension: string, measure: string): ChartConfig => ({
  type,
  xAxis: { field: dimension, showGridLines: true, logarithmic: false },
  yAxis: [{ field: measure, showGridLines: true, logarithmic: false }],
  showLegend: true,
  showDataLabels: false,
});

/**
 * Delivery Operations — a *believable business* dashboard (vs the Chart Gallery,
 * which is one-of-every-chart). It composes the patterns a real ops landing page
 * needs:
 *   • a KPI hero row of `metric` tiles, each scoped by a per-widget `filter`
 *     (active projects, at-risk projects, awaiting-review tasks) — the same
 *     dataset, sliced different ways;
 *   • comparison / distribution / trend charts underneath;
 *   • a global `dateRange` (created_at) and a global status filter so the whole
 *     board re-scopes from the header.
 *
 * Everything binds the semantic datasets by name (ADR-0021), so a metric is
 * defined once and reused.
 */
export const OpsDashboard: Dashboard = {
  name: 'showcase_ops_dashboard',
  label: 'Delivery Operations',
  description: 'Operations landing page — KPI hero row, project health, and task throughput.',
  columns: 12,
  dateRange: { field: 'created_at', defaultRange: 'last_90_days', allowCustomRange: true },
  globalFilters: [
    {
      field: 'status',
      label: 'Task Status',
      type: 'select',
      options: [
        { value: 'backlog', label: 'Backlog' },
        { value: 'todo', label: 'To Do' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'in_review', label: 'In Review' },
        { value: 'done', label: 'Done' },
      ],
      scope: 'dashboard',
    },
  ],
  widgets: [
    // ── KPI hero row — same project dataset, sliced by per-widget filter ──
    { id: 'kpi_active_projects', type: 'metric', title: 'Active Projects', dataset: projectDs, values: ['project_count'], filter: { status: 'active' }, colorVariant: 'blue', layout: { x: 0, y: 0, w: 3, h: 2 } },
    { id: 'kpi_at_risk', type: 'metric', title: 'At-Risk (Red)', dataset: projectDs, values: ['project_count'], filter: { health: 'red' }, colorVariant: 'danger', layout: { x: 3, y: 0, w: 3, h: 2 } },
    { id: 'kpi_awaiting_review', type: 'metric', title: 'Awaiting Review', dataset: taskDs, values: ['task_count'], filter: { status: 'in_review' }, colorVariant: 'warning', layout: { x: 6, y: 0, w: 3, h: 2 } },
    { id: 'kpi_total_budget', type: 'metric', title: 'Total Budget', dataset: projectDs, values: ['budget_sum'], colorVariant: 'success', layout: { x: 9, y: 0, w: 3, h: 2 } },

    // ── Health + throughput ──────────────────────────────────────────────
    { id: 'col_health', type: 'column', title: 'Projects by Health', dataset: projectDs, dimensions: ['health'], values: ['project_count'], chartConfig: cfg('column', 'health', 'project_count'), layout: { x: 0, y: 2, w: 4, h: 4 } },
    { id: 'bar_status', type: 'bar', title: 'Tasks by Status', dataset: taskDs, dimensions: ['status'], values: ['task_count'], chartConfig: cfg('bar', 'status', 'task_count'), layout: { x: 4, y: 2, w: 4, h: 4 } },
    { id: 'donut_priority', type: 'donut', title: 'Priority Mix', dataset: taskDs, dimensions: ['priority'], values: ['task_count'], chartConfig: cfg('donut', 'priority', 'task_count'), layout: { x: 8, y: 2, w: 4, h: 4 } },

    // ── Trend + account spend ────────────────────────────────────────────
    { id: 'line_created', type: 'line', title: 'Task Throughput (monthly)', dataset: taskDs, dimensions: ['created_at'], values: ['task_count'], chartConfig: cfg('line', 'created_at', 'task_count'), layout: { x: 0, y: 6, w: 6, h: 4 } },
    { id: 'table_spend', type: 'table', title: 'Budget vs Spent by Account', dataset: projectDs, dimensions: ['account'], values: ['project_count', 'budget_sum', 'spent_sum'], layout: { x: 6, y: 6, w: 6, h: 4 } },
  ],
};
