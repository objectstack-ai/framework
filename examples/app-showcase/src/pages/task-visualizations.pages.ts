// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Page } from '@objectstack/spec/ui';

/**
 * Visualization gallery — one interface page per record visualization, each
 * over the SAME showcase_task object. Demonstrates that a list/interface page
 * can be locked to any single visualization (single-entry
 * `appearance.allowedVisualizations` = no switcher), and that the per-viz
 * field bindings (kanban groupBy, calendar/gantt/timeline dates, gallery cover,
 * map location) are auto-derived from the object — the author only whitelists
 * the type.
 *
 * The last page (All Views) keeps the switcher open across every type, showing
 * the runtime visualization choice ON a page (not just on the object view).
 */
const base = {
  type: 'list' as const,
  object: 'showcase_task',
  kind: 'full' as const,
  template: 'default',
  isDefault: false,
  regions: [],
};

const cols = ['title', 'assignee', 'status', 'priority', 'due_date'];

export const TaskBoardPage: Page = {
  ...base,
  name: 'showcase_task_board',
  label: 'Task Board',
  interfaceConfig: {
    source: 'showcase_task',
    columns: [...cols, 'estimate_hours'],
    appearance: { showDescription: true, allowedVisualizations: ['kanban'] },
    userActions: { sort: true, search: true, filter: false, rowHeight: false, addRecordForm: false },
    showRecordCount: true,
  },
};

export const TaskCalendarPage: Page = {
  ...base,
  name: 'showcase_task_calendar',
  label: 'Task Calendar',
  interfaceConfig: {
    source: 'showcase_task',
    columns: cols,
    appearance: { showDescription: true, allowedVisualizations: ['calendar'] },
    userActions: { sort: false, search: true, filter: false, rowHeight: false, addRecordForm: false },
    showRecordCount: true,
  },
};

export const TaskGalleryPage: Page = {
  ...base,
  name: 'showcase_task_gallery',
  label: 'Task Gallery',
  interfaceConfig: {
    source: 'showcase_task',
    columns: [...cols, 'cover'],
    appearance: { showDescription: true, allowedVisualizations: ['gallery'] },
    userActions: { sort: true, search: true, filter: false, rowHeight: false, addRecordForm: false },
    showRecordCount: true,
  },
};

export const TaskSchedulePage: Page = {
  ...base,
  name: 'showcase_task_schedule',
  label: 'Team Schedule (Gantt)',
  interfaceConfig: {
    source: 'showcase_task',
    columns: [...cols, 'start_date', 'end_date', 'progress'],
    appearance: { showDescription: true, allowedVisualizations: ['gantt'] },
    userActions: { sort: true, search: true, filter: false, rowHeight: false, addRecordForm: false },
    showRecordCount: true,
  },
};

export const TaskTimelinePage: Page = {
  ...base,
  name: 'showcase_task_timeline',
  label: 'Activity Timeline',
  interfaceConfig: {
    source: 'showcase_task',
    columns: [...cols, 'created_at'],
    appearance: { showDescription: true, allowedVisualizations: ['timeline'] },
    userActions: { sort: true, search: true, filter: false, rowHeight: false, addRecordForm: false },
    showRecordCount: true,
  },
};

export const TaskMapPage: Page = {
  ...base,
  name: 'showcase_task_map',
  label: 'Work Map',
  interfaceConfig: {
    source: 'showcase_task',
    columns: [...cols, 'location'],
    appearance: { showDescription: true, allowedVisualizations: ['map'] },
    userActions: { sort: false, search: true, filter: false, rowHeight: false, addRecordForm: false },
    showRecordCount: true,
  },
};

export const TaskAllViewsPage: Page = {
  ...base,
  name: 'showcase_task_all_views',
  label: 'All Views',
  interfaceConfig: {
    source: 'showcase_task',
    columns: [...cols, 'cover', 'start_date', 'end_date', 'created_at', 'progress', 'location'],
    // Switcher open across every record visualization — the runtime
    // visualization choice ON an interface page.
    appearance: {
      showDescription: true,
      allowedVisualizations: ['grid', 'kanban', 'gallery', 'calendar', 'timeline', 'gantt', 'map'],
    },
    userActions: { sort: true, search: true, filter: false, rowHeight: false, addRecordForm: false },
    showRecordCount: true,
  },
};
