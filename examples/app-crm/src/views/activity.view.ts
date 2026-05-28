// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec';

export const ActivityViews = defineView({
  listViews: {
    all: {
      label: 'All Activities',
      type: 'grid',
      columns: [
        { field: 'subject' },
        { field: 'type' },
        { field: 'status' },
        { field: 'due_date' },
        { field: 'contact' },
        { field: 'account' },
        { field: 'opportunity' },
      ],
    },
    /**
     * Calendar view — uses due_date as the event anchor.
     * Demonstrates the CalendarConfigSchema shape (startDateField + titleField).
     */
    calendar: {
      label: 'Activity Calendar',
      type: 'calendar',
      columns: ['subject', 'type', 'status', 'due_date'],
      calendar: {
        startDateField: 'due_date',
        titleField:     'subject',
        colorField:     'type',
      },
    },
  },
  formViews: {
    default: {
      type: 'simple',
      sections: [
        {
          label: 'Activity Details',
          columns: 2,
          fields: [
            { field: 'subject',          required: true },
            { field: 'type',             required: true },
            { field: 'status',           required: true },
            { field: 'due_date' },
            { field: 'duration_minutes' },
          ],
        },
        {
          label: 'Related Records',
          columns: 2,
          fields: [
            { field: 'contact' },
            { field: 'account' },
            { field: 'opportunity' },
          ],
        },
        {
          label: 'Notes',
          columns: 1,
          fields: [
            { field: 'description' },
            { field: 'outcome' },
          ],
        },
      ],
    },
  },
});
