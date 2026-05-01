// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ListView } from '@objectstack/spec/ui';

/**
 * Default list view for sys_audit_log administration.
 * Displays platform audit trail with action and target information.
 */
export const AuditLogsView: ListView = {
  name: 'audit_logs',
  label: 'Audit Logs',
  type: 'grid',
  data: {
    provider: 'object',
    object: 'sys_audit_log',
  },
  columns: [
    { field: 'created_at', label: 'Timestamp', sortable: true },
    { field: 'action', label: 'Action', sortable: true },
    { field: 'user_id', label: 'Actor' },
    { field: 'object_name', label: 'Object' },
    { field: 'record_id', label: 'Record ID' },
  ],
  sort: [{ field: 'created_at', order: 'desc' }],
  filter: [],
  searchableFields: ['action', 'object_name', 'record_id'],
  pagination: {
    pageSize: 20,
  },
};
