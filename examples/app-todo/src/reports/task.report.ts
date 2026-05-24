// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ReportInput } from '@objectstack/spec/ui';

/** Tasks by Status Report */
export const TasksByStatusReport: ReportInput = {
  name: 'tasks_by_status',
  label: 'Tasks by Status',
  description: 'Summary of tasks grouped by status',
  objectName: 'todo_task',
  type: 'summary',
  columns: [
    { field: 'subject', label: 'Subject' },
    { field: 'priority', label: 'Priority' },
    { field: 'due_date', label: 'Due Date' },
    { field: 'owner', label: 'Assigned To' },
  ],
  groupingsDown: [{ field: 'status', sortOrder: 'asc' }],
};

/** Tasks by Priority Report */
export const TasksByPriorityReport: ReportInput = {
  name: 'tasks_by_priority',
  label: 'Tasks by Priority',
  description: 'Summary of tasks grouped by priority level',
  objectName: 'todo_task',
  type: 'summary',
  columns: [
    { field: 'subject', label: 'Subject' },
    { field: 'status', label: 'Status' },
    { field: 'due_date', label: 'Due Date' },
    { field: 'category', label: 'Category' },
  ],
  groupingsDown: [{ field: 'priority', sortOrder: 'desc' }],
  filter: { is_completed: false },
};

/** Tasks by Owner Report */
export const TasksByOwnerReport: ReportInput = {
  name: 'tasks_by_owner',
  label: 'Tasks by Owner',
  description: 'Task summary by assignee',
  objectName: 'todo_task',
  type: 'summary',
  columns: [
    { field: 'subject', label: 'Subject' },
    { field: 'status', label: 'Status' },
    { field: 'priority', label: 'Priority' },
    { field: 'due_date', label: 'Due Date' },
    { field: 'estimated_hours', label: 'Est. Hours', aggregate: 'sum' },
    { field: 'actual_hours', label: 'Actual Hours', aggregate: 'sum' },
  ],
  groupingsDown: [{ field: 'owner', sortOrder: 'asc' }],
  filter: { is_completed: false },
};

/** Overdue Tasks Report */
export const OverdueTasksReport: ReportInput = {
  name: 'overdue_tasks',
  label: 'Overdue Tasks',
  description: 'All overdue tasks that need attention',
  objectName: 'todo_task',
  type: 'tabular',
  columns: [
    { field: 'subject', label: 'Subject' },
    { field: 'due_date', label: 'Due Date' },
    { field: 'priority', label: 'Priority' },
    { field: 'owner', label: 'Assigned To' },
    { field: 'category', label: 'Category' },
  ],
  filter: { is_overdue: true, is_completed: false },
};

/** Completed Tasks Report */
export const CompletedTasksReport: ReportInput = {
  name: 'completed_tasks',
  label: 'Completed Tasks',
  description: 'All completed tasks with time tracking',
  objectName: 'todo_task',
  type: 'summary',
  columns: [
    { field: 'subject', label: 'Subject' },
    { field: 'completed_date', label: 'Completed Date' },
    { field: 'estimated_hours', label: 'Est. Hours', aggregate: 'sum' },
    { field: 'actual_hours', label: 'Actual Hours', aggregate: 'sum' },
  ],
  groupingsDown: [{ field: 'category', sortOrder: 'asc' }],
  filter: { is_completed: true },
};

/** Time Tracking Report */
export const TimeTrackingReport: ReportInput = {
  name: 'time_tracking',
  label: 'Time Tracking Report',
  description: 'Estimated vs actual hours analysis',
  objectName: 'todo_task',
  type: 'matrix',
  columns: [
    { field: 'estimated_hours', label: 'Estimated Hours', aggregate: 'sum' },
    { field: 'actual_hours', label: 'Actual Hours', aggregate: 'sum' },
  ],
  groupingsDown: [{ field: 'owner', sortOrder: 'asc' }],
  groupingsAcross: [{ field: 'category', sortOrder: 'asc' }],
  filter: { is_completed: true },
};
