// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Action } from '@objectstack/spec/ui';

/** Mark Task as Complete */
export const CompleteTaskAction: Action = {
  name: 'complete_task',
  label: 'Mark Complete',
  icon: 'check-circle',
  type: 'script',
  target: 'completeTask',
  locations: ['record_header', 'list_item'],
  successMessage: 'Task marked as complete!',
  refreshAfter: true,
};

/** Mark Task as In Progress */
export const StartTaskAction: Action = {
  name: 'start_task',
  label: 'Start Task',
  icon: 'play-circle',
  type: 'script',
  target: 'startTask',
  locations: ['record_header', 'list_item'],
  successMessage: 'Task started!',
  refreshAfter: true,
};

/** Defer Task */
export const DeferTaskAction: Action = {
  name: 'defer_task',
  label: 'Defer Task',
  icon: 'clock',
  type: 'modal',
  target: 'defer_task_modal',
  locations: ['record_header'],
  params: [
    {
      name: 'new_due_date',
      label: 'New Due Date',
      type: 'date',
      required: true,
    },
    {
      name: 'reason',
      label: 'Reason for Deferral',
      type: 'textarea',
      required: false,
    }
  ],
  successMessage: 'Task deferred successfully!',
  refreshAfter: true,
};

/** Set Reminder */
export const SetReminderAction: Action = {
  name: 'set_reminder',
  label: 'Set Reminder',
  icon: 'bell',
  type: 'modal',
  target: 'set_reminder_modal',
  locations: ['record_header', 'list_item'],
  params: [
    {
      name: 'reminder_date',
      label: 'Reminder Date/Time',
      type: 'datetime',
      required: true,
    }
  ],
  successMessage: 'Reminder set!',
  refreshAfter: true,
};

/** Clone Task */
export const CloneTaskAction: Action = {
  name: 'clone_task',
  label: 'Clone Task',
  icon: 'copy',
  type: 'script',
  target: 'cloneTask',
  locations: ['record_header'],
  successMessage: 'Task cloned successfully!',
  refreshAfter: true,
};

/** Mass Complete Tasks */
export const MassCompleteTasksAction: Action = {
  name: 'mass_complete',
  label: 'Complete Selected',
  icon: 'check-square',
  type: 'script',
  target: 'massCompleteTasks',
  locations: ['list_toolbar'],
  successMessage: 'Selected tasks marked as complete!',
  refreshAfter: true,
};

/** Delete Completed Tasks */
export const DeleteCompletedAction: Action = {
  name: 'delete_completed',
  label: 'Delete Completed',
  icon: 'trash-2',
  type: 'script',
  target: 'deleteCompletedTasks',
  locations: ['list_toolbar'],
  successMessage: 'Completed tasks deleted!',
  refreshAfter: true,
};

/** Export Tasks to CSV */
export const ExportToCsvAction: Action = {
  name: 'export_csv',
  label: 'Export to CSV',
  icon: 'download',
  type: 'script',
  target: 'exportTasksToCSV',
  locations: ['list_toolbar'],
  successMessage: 'Export completed!',
  refreshAfter: false,
};
