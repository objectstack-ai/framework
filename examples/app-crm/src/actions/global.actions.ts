// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Action } from '@objectstack/spec/ui';

/** Log a Call */
export const LogCallAction: Action = {
  name: 'log_call',
  label: 'Log a Call',
  icon: 'phone',
  type: 'modal',
  target: 'logCall',
  locations: ['record_header', 'list_item', 'record_related'],
  params: [
    {
      name: 'subject',
      label: 'Call Subject',
      type: 'text',
      required: true,
    },
    {
      name: 'duration',
      label: 'Duration (minutes)',
      type: 'number',
      required: true,
    },
    {
      name: 'notes',
      label: 'Call Notes',
      type: 'textarea',
      required: false,
    }
  ],
  successMessage: 'Call logged successfully!',
  refreshAfter: true,
};

/** Export to CSV */
export const ExportToCsvAction: Action = {
  name: 'export_csv',
  label: 'Export to CSV',
  icon: 'download',
  type: 'script',
  target: 'exportToCSV',
  locations: ['list_toolbar'],
  successMessage: 'Export completed!',
  refreshAfter: false,
};
