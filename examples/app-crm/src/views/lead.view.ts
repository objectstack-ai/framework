// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec';

export const LeadViews = defineView({
  listViews: {
    all: {
      label: 'All Leads',
      type: 'grid',
      columns: [
        { field: 'name' },
        { field: 'company' },
        { field: 'status' },
        { field: 'source' },
        { field: 'lead_score' },
        { field: 'assigned_to' },
        { field: 'email' },
      ],
    },
    pipeline: {
      label: 'Lead Pipeline (Kanban)',
      type: 'kanban',
      columns: ['name', 'company', 'source', 'lead_score'],
      kanban: {
        groupByField: 'status',
        summarizeField: 'lead_score',
        columns: ['name', 'company', 'source', 'lead_score'],
      },
    },
  },
  formViews: {
    default: {
      type: 'simple',
      sections: [
        {
          label: 'Lead Information',
          columns: 2,
          fields: [
            { field: 'name',     required: true },
            { field: 'company' },
            { field: 'email' },
            { field: 'phone' },
            { field: 'title' },
            { field: 'source' },
          ],
        },
        {
          label: 'Qualification',
          columns: 2,
          fields: [
            { field: 'status',    required: true },
            { field: 'lead_score' },
            { field: 'assigned_to' },
            { field: 'account' },
          ],
        },
        {
          label: 'Conversion',
          columns: 2,
          fields: [
            { field: 'converted_opportunity' },
            { field: 'is_closed' },
          ],
        },
        {
          label: 'Notes',
          columns: 1,
          fields: [{ field: 'notes' }],
        },
      ],
    },
  },
});
