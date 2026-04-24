// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

export const Case = ObjectSchema.create({
  name: 'case',
  label: 'Case',
  pluralLabel: 'Cases',
  icon: 'life-buoy',
  description: 'Customer support cases and service requests',
  
  fields: {
    // Case Information
    case_number: Field.autonumber({
      label: 'Case Number',
      format: 'CASE-{00000}',
    }),
    
    subject: Field.text({
      label: 'Subject',
      required: true,
      searchable: true,
      maxLength: 255,
    }),
    
    description: Field.markdown({
      label: 'Description',
      required: true,
    }),
    
    // Relationships
    account: Field.lookup('account', {
      label: 'Account',
    }),
    
    contact: Field.lookup('contact', {
      label: 'Contact',
      required: true,
      referenceFilters: ['account = {case.account}'],
    }),
    
    // Case Management
    status: Field.select({
      label: 'Status',
      required: true,
      options: [
        { label: 'New', value: 'new', color: '#808080', default: true },
        { label: 'In Progress', value: 'in_progress', color: '#FFA500' },
        { label: 'Waiting on Customer', value: 'waiting_customer', color: '#FFD700' },
        { label: 'Waiting on Support', value: 'waiting_support', color: '#4169E1' },
        { label: 'Escalated', value: 'escalated', color: '#FF0000' },
        { label: 'Resolved', value: 'resolved', color: '#00AA00' },
        { label: 'Closed', value: 'closed', color: '#006400' },
      ]
    }),
    
    priority: Field.select({
      label: 'Priority',
      required: true,
      options: [
        { label: 'Low', value: 'low', color: '#4169E1', default: true },
        { label: 'Medium', value: 'medium', color: '#FFA500' },
        { label: 'High', value: 'high', color: '#FF4500' },
        { label: 'Critical', value: 'critical', color: '#FF0000' },
      ]
    }),
    
    type: Field.select({
      label: 'Case Type',
      options: [
        { label: 'Question', value: 'question' },
        { label: 'Problem', value: 'problem' },
        { label: 'Feature Request', value: 'feature_request' },
        { label: 'Bug', value: 'bug' },
      ]
    }),
    
    origin: Field.select({
      label: 'Case Origin',
      options: [
        { label: 'Email', value: 'email' },
        { label: 'Phone', value: 'phone' },
        { label: 'Web', value: 'web' },
        { label: 'Chat', value: 'chat' },
        { label: 'Social Media', value: 'social_media' },
      ]
    }),
    
    // Assignment
    owner: Field.lookup('user', {
      label: 'Case Owner',
    }),
    
    // SLA and Metrics
    created_date: Field.datetime({
      label: 'Created Date',
      readonly: true,
    }),
    
    closed_date: Field.datetime({
      label: 'Closed Date',
      readonly: true,
    }),
    
    first_response_date: Field.datetime({
      label: 'First Response Date',
      readonly: true,
    }),
    
    resolution_time_hours: Field.number({
      label: 'Resolution Time (Hours)',
      readonly: true,
      scale: 2,
    }),
    
    sla_due_date: Field.datetime({
      label: 'SLA Due Date',
    }),
    
    is_sla_violated: Field.boolean({
      label: 'SLA Violated',
      defaultValue: false,
      readonly: true,
    }),
    
    // Escalation
    is_escalated: Field.boolean({
      label: 'Escalated',
      defaultValue: false,
    }),
    
    escalation_reason: Field.textarea({
      label: 'Escalation Reason',
    }),
    
    // Related case
    parent_case: Field.lookup('case', {
      label: 'Parent Case',
      description: 'Related parent case',
    }),
    
    // Resolution
    resolution: Field.markdown({
      label: 'Resolution',
    }),
    
    // Customer satisfaction
    customer_rating: Field.rating(5, {
      label: 'Customer Satisfaction',
      description: 'Customer satisfaction rating (1-5 stars)',
    }),
    
    customer_feedback: Field.textarea({
      label: 'Customer Feedback',
    }),
    
    // Customer signature (for case resolution acknowledgment)
    customer_signature: Field.signature({
      label: 'Customer Signature',
      description: 'Digital signature acknowledging case resolution',
    }),
    
    // Internal notes
    internal_notes: Field.markdown({
      label: 'Internal Notes',
      description: 'Internal notes not visible to customer',
    }),
    
    // Flags
    is_closed: Field.boolean({
      label: 'Is Closed',
      defaultValue: false,
      readonly: true,
    }),
  },
  
  // Database indexes for performance
  indexes: [
    { fields: ['case_number'], unique: true },
    { fields: ['account'] },
    { fields: ['owner'] },
    { fields: ['status'] },
    { fields: ['priority'] },
  ],
  
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
  
  titleFormat: '{case_number} - {subject}',
  compactLayout: ['case_number', 'subject', 'account', 'status', 'priority'],
  
  // Removed: list_views and form_views belong in UI configuration, not object definition
  
  validations: [
    {
      name: 'resolution_required_for_closed',
      type: 'script',
      severity: 'error',
      message: 'Resolution is required when closing a case',
      condition: 'status = "closed" AND ISBLANK(resolution)',
    },
    {
      name: 'escalation_reason_required',
      type: 'script',
      severity: 'error',
      message: 'Escalation reason is required when escalating a case',
      condition: 'is_escalated = true AND ISBLANK(escalation_reason)',
    },
    {
      name: 'case_status_progression',
      type: 'state_machine',
      severity: 'warning',
      message: 'Invalid status transition',
      field: 'status',
      transitions: {
        'new': ['in_progress', 'waiting_customer', 'closed'],
        'in_progress': ['waiting_customer', 'waiting_support', 'escalated', 'resolved'],
        'waiting_customer': ['in_progress', 'closed'],
        'waiting_support': ['in_progress', 'escalated'],
        'escalated': ['in_progress', 'resolved'],
        'resolved': ['closed', 'in_progress'],  // Can reopen
        'closed': ['in_progress'],  // Can reopen
      }
    },
  ],
  
  workflows: [
    {
      name: 'set_closed_flag',
      objectName: 'case',
      triggerType: 'on_create_or_update',
      criteria: 'ISCHANGED(status)',
      active: true,
      actions: [
        {
          name: 'update_closed_flag',
          type: 'field_update',
          field: 'is_closed',
          value: 'status = "closed"',
        }
      ],
    },
    {
      name: 'set_closed_date',
      objectName: 'case',
      triggerType: 'on_update',
      criteria: 'ISCHANGED(status) AND status = "closed"',
      active: true,
      actions: [
        {
          name: 'set_date',
          type: 'field_update',
          field: 'closed_date',
          value: 'NOW()',
        }
      ],
    },
    {
      name: 'calculate_resolution_time',
      objectName: 'case',
      triggerType: 'on_update',
      criteria: 'ISCHANGED(closed_date) AND NOT(ISBLANK(closed_date))',
      active: true,
      actions: [
        {
          name: 'calc_time',
          type: 'field_update',
          field: 'resolution_time_hours',
          value: 'HOURS(created_date, closed_date)',
        }
      ],
    },
    {
      name: 'notify_on_critical',
      objectName: 'case',
      triggerType: 'on_create_or_update',
      criteria: 'priority = "critical"',
      active: true,
      actions: [
        {
          name: 'email_support_manager',
          type: 'email_alert',
          template: 'critical_case_alert',
          recipients: ['support_manager@example.com'],
        }
      ],
    },
    {
      name: 'notify_on_escalation',
      objectName: 'case',
      triggerType: 'on_update',
      criteria: 'ISCHANGED(is_escalated) AND is_escalated = true',
      active: true,
      actions: [
        {
          name: 'email_escalation_team',
          type: 'email_alert',
          template: 'case_escalation_alert',
          recipients: ['escalation_team@example.com'],
        }
      ],
    },
  ],
});
