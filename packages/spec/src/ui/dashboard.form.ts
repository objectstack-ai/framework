// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from './view.zod';

export const dashboardForm = defineForm({
  schemaId: 'dashboard',
  type: 'tabbed',
  sections: [
    {
      label: 'Basics',
      fields: [
        { field: 'name', required: true },
        { field: 'label', required: true },
        { field: 'description' },
      ],
    },
    {
      label: 'Layout',
      description: 'Grid sizing and refresh cadence.',
      fields: [
        { field: 'columns', helpText: 'Number of grid columns (default 12)' },
        { field: 'gap', helpText: 'Grid gap in Tailwind spacing units' },
        { field: 'refreshInterval', helpText: 'Auto-refresh interval (seconds)' },
        { field: 'header', widget: 'json' },
      ],
    },
    {
      label: 'Widgets',
      description: 'Cards and charts placed on the grid.',
      fields: [
        { field: 'widgets', widget: 'master-detail', required: true },
      ],
    },
    {
      label: 'Filters',
      fields: [
        { field: 'dateRange', widget: 'json' },
        { field: 'globalFilters', widget: 'master-detail' },
      ],
    },
    {
      label: 'Advanced',
      fields: [
        { field: 'aria', widget: 'json' },
        { field: 'performance', widget: 'json' },
      ],
    },
  ],
});
