// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

export const Task = ObjectSchema.create({
  name: 'task',
  label: 'Task',
  pluralLabel: 'Tasks',
  icon: 'check-square',
  description: 'Personal tasks and to-do items',
  
  fields: {
    // Task Information
    subject: Field.text({
      label: 'Subject',
      required: true,
      searchable: true,
      maxLength: 255,
    }),
    
    description: Field.markdown({
      label: 'Description',
    }),
    
    // Task Management
    status: Field.select({
      label: 'Status',
      required: true,
      options: [
        { label: 'Not Started', value: 'not_started', color: '#808080', default: true },
        { label: 'In Progress', value: 'in_progress', color: '#3B82F6' },
        { label: 'Waiting', value: 'waiting', color: '#F59E0B' },
        { label: 'Completed', value: 'completed', color: '#10B981' },
        { label: 'Deferred', value: 'deferred', color: '#6B7280' },
      ]
    }),
    
    priority: Field.select({
      label: 'Priority',
      required: true,
      options: [
        { label: 'Low', value: 'low', color: '#60A5FA', default: true },
        { label: 'Normal', value: 'normal', color: '#10B981' },
        { label: 'High', value: 'high', color: '#F59E0B' },
        { label: 'Urgent', value: 'urgent', color: '#EF4444' },
      ]
    }),
    
    category: Field.select({
      label: 'Category',
      options: [
        { label: 'Personal', value: 'personal' },
        { label: 'Work', value: 'work' },
        { label: 'Shopping', value: 'shopping' },
        { label: 'Health', value: 'health' },
        { label: 'Finance', value: 'finance' },
        { label: 'Other', value: 'other' },
      ]
    }),
    
    // Dates
    due_date: Field.date({
      label: 'Due Date',
    }),
    
    reminder_date: Field.datetime({
      label: 'Reminder Date/Time',
    }),
    
    completed_date: Field.datetime({
      label: 'Completed Date',
      readonly: true,
    }),
    
    // Assignment
    owner: Field.lookup('user', {
      label: 'Assigned To',
      required: true,
    }),
    
    // Tags
    tags: Field.select({
      label: 'Tags',
      multiple: true,
      options: [
        { label: 'Important', value: 'important', color: '#EF4444' },
        { label: 'Quick Win', value: 'quick_win', color: '#10B981' },
        { label: 'Blocked', value: 'blocked', color: '#F59E0B' },
        { label: 'Follow Up', value: 'follow_up', color: '#3B82F6' },
        { label: 'Review', value: 'review', color: '#8B5CF6' },
      ]
    }),
    
    // Recurrence
    is_recurring: Field.boolean({
      label: 'Recurring Task',
      defaultValue: false,
    }),
    
    recurrence_type: Field.select({
      label: 'Recurrence Type',
      options: [
        { label: 'Daily', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Monthly', value: 'monthly' },
        { label: 'Yearly', value: 'yearly' },
      ]
    }),
    
    recurrence_interval: Field.number({
      label: 'Recurrence Interval',
      defaultValue: 1,
      min: 1,
    }),
    
    // Flags
    is_completed: Field.boolean({
      label: 'Is Completed',
      defaultValue: false,
      readonly: true,
    }),
    
    is_overdue: Field.boolean({
      label: 'Is Overdue',
      defaultValue: false,
      readonly: true,
    }),
    
    // Progress
    progress_percent: Field.percent({
      label: 'Progress (%)',
      min: 0,
      max: 100,
      defaultValue: 0,
    }),
    
    // Time Tracking
    estimated_hours: Field.number({
      label: 'Estimated Hours',
      scale: 2,
      min: 0,
    }),
    
    actual_hours: Field.number({
      label: 'Actual Hours',
      scale: 2,
      min: 0,
    }),
    
    // Additional fields
    notes: Field.richtext({
      label: 'Notes',
      description: 'Rich text notes with formatting',
    }),
    
    category_color: Field.color({
      label: 'Category Color',
      colorFormat: 'hex',
      presetColors: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'],
    }),
  },
  
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    files: true,
    feeds: true,
    activities: true,
    trash: true,
    mru: true,
  },
  
  // Database indexes for performance
  indexes: [
    { fields: ['status'], type: 'btree' },
    { fields: ['priority'], type: 'btree' },
    { fields: ['owner'], type: 'btree' },
    { fields: ['due_date'], type: 'btree' },
    { fields: ['category'], type: 'btree' },
  ],
  
  titleFormat: '{subject}',
  compactLayout: ['subject', 'status', 'priority', 'due_date', 'owner'],
  
  validations: [
    {
      name: 'completed_date_required',
      type: 'script',
      severity: 'error',
      message: 'Completed date is required when status is Completed',
      condition: 'status = "completed" AND ISBLANK(completed_date)',
    },
    {
      name: 'recurrence_fields_required',
      type: 'script',
      severity: 'error',
      message: 'Recurrence type is required for recurring tasks',
      condition: 'is_recurring = true AND ISBLANK(recurrence_type)',
    },
  ],
  
  workflows: [
    {
      name: 'set_completed_flag',
      objectName: 'task',
      triggerType: 'on_create_or_update',
      criteria: 'ISCHANGED(status)',
      active: true,
      actions: [
        {
          name: 'update_completed_flag',
          type: 'field_update',
          field: 'is_completed',
          value: 'status = "completed"',
        }
      ],
    },
    {
      name: 'set_completed_date',
      objectName: 'task',
      triggerType: 'on_update',
      criteria: 'ISCHANGED(status) AND status = "completed"',
      active: true,
      actions: [
        {
          name: 'set_date',
          type: 'field_update',
          field: 'completed_date',
          value: 'NOW()',
        },
        {
          name: 'set_progress',
          type: 'field_update',
          field: 'progress_percent',
          value: '100',
        }
      ],
    },
    {
      name: 'check_overdue',
      objectName: 'task',
      triggerType: 'on_create_or_update',
      criteria: 'due_date < TODAY() AND is_completed = false',
      active: true,
      actions: [
        {
          name: 'set_overdue_flag',
          type: 'field_update',
          field: 'is_overdue',
          value: 'true',
        }
      ],
    },
    {
      name: 'notify_on_urgent',
      objectName: 'task',
      triggerType: 'on_create_or_update',
      criteria: 'priority = "urgent" AND is_completed = false',
      active: true,
      actions: [
        {
          name: 'email_owner',
          type: 'email_alert',
          template: 'urgent_task_alert',
          recipients: ['{owner.email}'],
        }
      ],
    },
  ],
});
