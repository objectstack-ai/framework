// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ListView } from '@objectstack/spec/ui';

/**
 * Default list view for sys_user administration.
 * Displays all users with key identity fields.
 */
export const UsersView: ListView = {
  name: 'users',
  label: 'Users',
  type: 'grid',
  data: {
    provider: 'object',
    object: 'sys_user',
  },
  columns: [
    { field: 'name', label: 'Name', sortable: true },
    { field: 'email', label: 'Email', sortable: true },
    { field: 'phone', label: 'Phone' },
    { field: 'status', label: 'Status', sortable: true },
    { field: 'active', label: 'Active', sortable: true },
    { field: 'created_at', label: 'Created', sortable: true },
  ],
  sort: [{ field: 'created_at', order: 'desc' }],
  filter: [],
  searchableFields: ['name', 'email'],
  pagination: {
    pageSize: 20,
  },
};
