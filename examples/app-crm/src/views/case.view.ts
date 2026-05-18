// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec/ui';

/**
 * Case (Service) Views
 *
 *   • grid     — support queue with SLA columns
 *   • kanban   — case workflow grouped by status
 *   • timeline — chronological case stream
 *   • calendar — SLA due-date calendar
 */
export const CaseViews = defineView({
  list: {
    type: 'grid',
    name: 'all_cases',
    label: 'All Cases',
    data: { provider: 'object', object: 'case' },
    columns: [
      { field: 'case_number', width: 130, sortable: true, link: true, pinned: 'left' },
      { field: 'subject', width: 280, sortable: true },
      { field: 'account', width: 180 },
      { field: 'contact', width: 160 },
      { field: 'priority', width: 110, sortable: true },
      { field: 'status', width: 130, sortable: true },
      { field: 'origin', width: 120 },
      { field: 'sla_due_date', width: 160, sortable: true },
      { field: 'is_sla_violated', width: 110, align: 'center' },
      { field: 'is_escalated', width: 110, align: 'center' },
      { field: 'owner', width: 150 },
    ],
    sort: [
      { field: 'priority', order: 'desc' },
      { field: 'sla_due_date', order: 'asc' },
    ],
    rowColor: {
      field: 'priority',
      colors: { critical: '#dc2626', high: '#f97316', medium: '#eab308', low: '#94a3b8' },
    },
    selection: { type: 'multiple' },
    pagination: { pageSize: 50 },
    appearance: {
      showDescription: true,
      allowedVisualizations: ['grid', 'kanban', 'calendar', 'timeline'],
    },
    tabs: [
      { name: 'all', label: 'All', view: 'all_cases', isDefault: true, pinned: true },
      { name: 'workflow', label: 'Workflow', icon: 'columns-3', view: 'case_workflow' },
      { name: 'sla', label: 'SLA', icon: 'calendar', view: 'sla_calendar' },
      { name: 'timeline', label: 'Timeline', icon: 'git-commit-horizontal', view: 'case_timeline' },
      { name: 'escalated', label: 'Escalated', icon: 'triangle-alert', view: 'escalated_cases' },
    ],
  },

  listViews: {
    /** Service workflow board */
    case_workflow: {
      name: 'case_workflow',
      type: 'kanban',
      label: 'Service Workflow',
      data: { provider: 'object', object: 'case' },
      columns: ['case_number', 'subject', 'priority', 'sla_due_date'],
      kanban: {
        groupByField: 'status',
        columns: ['case_number', 'subject', 'account', 'priority', 'owner'],
      },
      filter: [{ field: 'is_closed', operator: 'equals', value: false }],
      navigation: { mode: 'drawer', width: '640px' },
    },

    /** SLA calendar */
    sla_calendar: {
      name: 'sla_calendar',
      type: 'calendar',
      label: 'SLA Calendar',
      data: { provider: 'object', object: 'case' },
      columns: ['case_number', 'subject', 'priority'],
      calendar: {
        startDateField: 'sla_due_date',
        titleField: 'subject',
        colorField: 'priority',
      },
    },

    /** Chronological case stream */
    case_timeline: {
      name: 'case_timeline',
      type: 'timeline',
      label: 'Case Timeline',
      data: { provider: 'object', object: 'case' },
      columns: ['case_number', 'subject'],
      timeline: {
        startDateField: 'created_date',
        endDateField: 'closed_date',
        titleField: 'subject',
        groupByField: 'owner',
        colorField: 'status',
        scale: 'day',
      },
    },

    escalated_cases: {
      name: 'escalated_cases',
      type: 'grid',
      label: 'Escalated Cases',
      data: { provider: 'object', object: 'case' },
      columns: ['case_number', 'subject', 'account', 'priority', 'sla_due_date', 'owner'],
      filter: [{ field: 'is_escalated', operator: 'equals', value: true }],
      sort: [{ field: 'priority', order: 'desc' }],
    },

    /** SLA-at-risk: open, not yet violated, due within 4 hours */
    sla_at_risk: {
      name: 'sla_at_risk',
      type: 'grid',
      label: '⏰ SLA at Risk',
      data: { provider: 'object', object: 'case' },
      columns: ['case_number', 'subject', 'account', 'priority', 'sla_due_date', 'owner'],
      filter: [
        { field: 'is_closed', operator: 'equals', value: false },
        { field: 'is_sla_violated', operator: 'equals', value: false },
        { field: 'sla_due_date', operator: 'less_than_or_equal', value: '{NOW() + 4h}' },
      ],
      sort: [{ field: 'sla_due_date', order: 'asc' }],
    },
  },

  form: {
    type: 'tabbed',
    data: { provider: 'object', object: 'case' },
    sections: [
      {
        label: 'Case',
        columns: 2,
        fields: [
          'case_number',
          { field: 'subject', required: true, colSpan: 2 },
          { field: 'account', required: true },
          'contact',
          { field: 'status', required: true },
          'priority',
          'origin',
          'owner',
        ],
      },
      {
        label: 'SLA',
        columns: 2,
        fields: [
          'created_date',
          'first_response_date',
          'sla_due_date',
          'resolution_time_hours',
          'is_sla_violated',
          'is_escalated',
          'escalation_reason',
          'parent_case',
        ],
      },
      {
        label: 'Resolution',
        columns: 1,
        fields: ['resolution', 'internal_notes', 'customer_rating', 'customer_feedback', 'customer_signature', 'closed_date', 'is_closed'],
      },
    ],
  },
});
