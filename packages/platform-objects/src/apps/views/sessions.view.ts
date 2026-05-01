// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ListView } from '@objectstack/spec/ui';

/**
 * Default list view for sys_session administration.
 * Displays all active user sessions with metadata.
 */
export const SessionsView: ListView = {
  name: 'sessions',
  label: 'Sessions',
  type: 'grid',
  data: {
    provider: 'object',
    object: 'sys_session',
  },
  columns: [
    { field: 'user_id', label: 'User', sortable: true },
    { field: 'ip_address', label: 'IP Address' },
    { field: 'created_at', label: 'Created', sortable: true },
    { field: 'expires_at', label: 'Expires', sortable: true },
  ],
  sort: [{ field: 'created_at', order: 'desc' }],
  filter: [],
  searchableFields: ['user_id'],
  pagination: {
    pageSize: 20,
  },
};
