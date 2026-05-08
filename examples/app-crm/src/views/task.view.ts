// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec/ui';

/**
 * Task Views
 *
 *   • grid     — to-do list with completion controls
 *   • kanban   — work board grouped by status
 *   • calendar — schedule by due_date
 *   • gantt    — execution plan from reminder_date → due_date
 *   • timeline — chronological worklog grouped by owner
 */
export const TaskViews = defineView({
  list: {
    type: 'grid',
    name: 'all_tasks',
    label: 'All Tasks',
    data: { provider: 'object', object: 'task' },
    columns: [
      { field: 'is_completed', width: 60, align: 'center' },
      { field: 'subject', width: 280, sortable: true, link: true },
      { field: 'status', width: 130, sortable: true },
      { field: 'priority', width: 110, sortable: true },
      { field: 'due_date', width: 140, sortable: true },
      { field: 'progress_percent', width: 130, align: 'right' },
      { field: 'owner', width: 150 },
      { field: 'is_overdue', width: 100, align: 'center' },
    ],
    sort: [
      { field: 'is_completed', order: 'asc' },
      { field: 'due_date', order: 'asc' },
    ],
    rowColor: {
      field: 'priority',
      colors: { critical: '#dc2626', high: '#f97316', medium: '#eab308', low: '#94a3b8' },
    },
    selection: { type: 'multiple' },
    pagination: { pageSize: 50 },
    appearance: {
      showDescription: true,
      allowedVisualizations: ['grid', 'kanban', 'calendar', 'gantt', 'timeline'],
    },
    tabs: [
      { name: 'all', label: 'All', view: 'all_tasks', isDefault: true, pinned: true },
      { name: 'board', label: 'Board', icon: 'columns-3', view: 'task_board' },
      { name: 'schedule', label: 'Schedule', icon: 'calendar', view: 'task_calendar' },
      { name: 'plan', label: 'Plan', icon: 'gantt-chart', view: 'task_gantt' },
      { name: 'worklog', label: 'Worklog', icon: 'git-commit-horizontal', view: 'task_timeline' },
      { name: 'mine', label: 'My Tasks', icon: 'user', view: 'my_open_tasks' },
    ],
  },

  listViews: {
    /** Work board */
    task_board: {
      name: 'task_board',
      type: 'kanban',
      label: 'Task Board',
      data: { provider: 'object', object: 'task' },
      columns: ['subject', 'priority', 'due_date', 'owner'],
      kanban: {
        groupByField: 'status',
        columns: ['subject', 'priority', 'due_date', 'progress_percent'],
      },
      filter: [{ field: 'is_completed', operator: 'equals', value: false }],
      navigation: { mode: 'drawer', width: '520px' },
    },

    /** Schedule view */
    task_calendar: {
      name: 'task_calendar',
      type: 'calendar',
      label: 'Task Schedule',
      data: { provider: 'object', object: 'task' },
      columns: ['subject', 'priority', 'owner'],
      calendar: {
        startDateField: 'due_date',
        titleField: 'subject',
        colorField: 'priority',
      },
    },

    /** Execution plan */
    task_gantt: {
      name: 'task_gantt',
      type: 'gantt',
      label: 'Execution Plan',
      data: { provider: 'object', object: 'task' },
      columns: ['subject', 'owner', 'progress_percent'],
      gantt: {
        startDateField: 'reminder_date',
        endDateField: 'due_date',
        titleField: 'subject',
        progressField: 'progress_percent',
      },
    },

    /** Worklog timeline */
    task_timeline: {
      name: 'task_timeline',
      type: 'timeline',
      label: 'Worklog Timeline',
      data: { provider: 'object', object: 'task' },
      columns: ['subject', 'status'],
      timeline: {
        startDateField: 'reminder_date',
        endDateField: 'due_date',
        titleField: 'subject',
        groupByField: 'owner',
        colorField: 'status',
        scale: 'week',
      },
    },

    my_open_tasks: {
      name: 'my_open_tasks',
      type: 'grid',
      label: 'My Open Tasks',
      data: { provider: 'object', object: 'task' },
      columns: ['subject', 'priority', 'due_date', 'progress_percent'],
      filter: [
        { field: 'owner', operator: 'equals', value: '{current_user_id}' },
        { field: 'is_completed', operator: 'equals', value: false },
      ],
      sort: [{ field: 'due_date', order: 'asc' }],
    },
  },

  form: {
    type: 'simple',
    data: { provider: 'object', object: 'task' },
    sections: [
      {
        label: 'Task',
        columns: 2,
        fields: [
          { field: 'subject', required: true, colSpan: 2 },
          { field: 'status', required: true },
          'priority',
          'due_date',
          'reminder_date',
          'owner',
          'progress_percent',
        ],
      },
      {
        label: 'Related Records',
        collapsible: true,
        columns: 2,
        fields: [
          'related_to_account',
          'related_to_contact',
          'related_to_opportunity',
          'related_to_lead',
          'related_to_case',
        ],
      },
      {
        label: 'Recurrence & Effort',
        collapsible: true,
        collapsed: true,
        columns: 2,
        fields: [
          'is_recurring',
          'recurrence_interval',
          'recurrence_end_date',
          'estimated_hours',
          'actual_hours',
        ],
      },
    ],
  },
});
