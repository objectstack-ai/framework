// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineCube } from '@objectstack/spec/data';

/**
 * Delivery cube — the analytics semantic layer (`defineCube`) over the
 * project-delivery backbone. Sits alongside the `dataset` demos
 * (src/ui/datasets/) to show BOTH analytics surfaces: datasets feed
 * reports/dashboards (ADR-0021), cubes feed the analytics service
 * (`/api/v1/analytics/*` — the CLI auto-loads the foundational analytics
 * capability and registers `analyticsCubes` with it).
 *
 * Base table = `showcase_task` (object name IS the table name, Prime
 * Directive #6); the join reaches the parent project through the
 * master-detail column.
 */
export const DeliveryCube = defineCube({
  name: 'showcase_delivery',
  title: 'Delivery Analytics',
  description: 'Task throughput and effort analytics across the delivery backbone.',
  sql: 'showcase_task',
  measures: {
    count: {
      name: 'count',
      label: 'Task Count',
      type: 'count',
      sql: '*',
    },
    total_estimate_hours: {
      name: 'total_estimate_hours',
      label: 'Total Estimated Hours',
      type: 'sum',
      sql: 'estimate_hours',
    },
    avg_estimate_hours: {
      name: 'avg_estimate_hours',
      label: 'Average Estimate (h)',
      type: 'avg',
      sql: 'estimate_hours',
    },
    done_rate: {
      name: 'done_rate',
      label: 'Done Rate (%)',
      type: 'number',
      sql: "SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)",
      format: 'percent',
    },
  },
  dimensions: {
    status: {
      name: 'status',
      label: 'Status',
      type: 'string',
      sql: 'status',
    },
    priority: {
      name: 'priority',
      label: 'Priority',
      type: 'string',
      sql: 'priority',
    },
    due_date: {
      name: 'due_date',
      label: 'Due Date',
      type: 'time',
      sql: 'due_date',
    },
    assignee: {
      name: 'assignee',
      label: 'Assignee',
      type: 'string',
      sql: 'assignee',
    },
  },
  joins: {
    showcase_project: {
      name: 'showcase_project',
      relationship: 'many_to_one',
      sql: '${showcase_delivery}.project = ${showcase_project}.id',
    },
  },
  refreshKey: {
    every: '1 hour',
  },
  public: false,
});

export const allCubes = [DeliveryCube];
