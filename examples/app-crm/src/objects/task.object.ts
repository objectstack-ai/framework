// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

export const Task = ObjectSchema.create({
  name: 'task',
  label: 'Task',
  pluralLabel: 'Tasks',
  icon: 'check-square',
  description: 'Activities and to-do items',
  
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
        { label: 'In Progress', value: 'in_progress', color: '#FFA500' },
        { label: 'Waiting', value: 'waiting', color: '#FFD700' },
        { label: 'Completed', value: 'completed', color: '#00AA00' },
        { label: 'Deferred', value: 'deferred', color: '#999999' },
      ]
    }),
    
    priority: Field.select({
      label: 'Priority',
      required: true,
      options: [
        { label: 'Low', value: 'low', color: '#4169E1', default: true },
        { label: 'Normal', value: 'normal', color: '#00AA00' },
        { label: 'High', value: 'high', color: '#FFA500' },
        { label: 'Urgent', value: 'urgent', color: '#FF0000' },
      ]
    }),
    
    type: Field.select({
      label: 'Task Type',
      options: [
        { label: 'Call', value: 'call' },
        { label: 'Email', value: 'email' },
        { label: 'Meeting', value: 'meeting' },
        { label: 'Follow-up', value: 'follow_up' },
        { label: 'Demo', value: 'demo' },
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
    
    // Related To (Polymorphic relationship - can link to multiple object types)
    related_to_type: Field.select({
      label: 'Related To Type',
      options: [
        { label: 'Account', value: 'account' },
        { label: 'Contact', value: 'contact' },
        { label: 'Opportunity', value: 'opportunity' },
        { label: 'Lead', value: 'lead' },
        { label: 'Case', value: 'case' },
      ]
    }),
    
    related_to_account: Field.lookup('account', {
      label: 'Related Account',
    }),
    
    related_to_contact: Field.lookup('contact', {
      label: 'Related Contact',
    }),
    
    related_to_opportunity: Field.lookup('opportunity', {
      label: 'Related Opportunity',
    }),
    
    related_to_lead: Field.lookup('lead', {
      label: 'Related Lead',
    }),
    
    related_to_case: Field.lookup('case', {
      label: 'Related Case',
    }),
    
    // Recurrence (for recurring tasks)
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
    
    recurrence_end_date: Field.date({
      label: 'Recurrence End Date',
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
    
    // Time tracking
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
  },
  
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    files: true,
    feeds: true,            // Enable social feed, comments, and mentions
    activities: true,       // Enable tasks and events tracking
    trash: true,
    mru: true,              // Track Most Recently Used
  },
  
  // Database indexes for performance
  indexes: [
    { fields: ['status'], type: 'btree' },
    { fields: ['priority'], type: 'btree' },
    { fields: ['owner'], type: 'btree' },
    { fields: ['due_date'], type: 'btree' },
  ],
  
  titleFormat: '{subject}',
  compactLayout: ['subject', 'status', 'priority', 'due_date', 'owner'],
  
  // Removed: list_views and form_views belong in UI configuration, not object definition
  
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
    {
      name: 'related_to_required',
      type: 'script',
      severity: 'warning',
      message: 'At least one related record should be selected',
      condition: 'ISBLANK(related_to_account) AND ISBLANK(related_to_contact) AND ISBLANK(related_to_opportunity) AND ISBLANK(related_to_lead) AND ISBLANK(related_to_case)',
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
