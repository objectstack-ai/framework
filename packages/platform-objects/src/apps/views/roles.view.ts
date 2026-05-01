// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ListView } from '@objectstack/spec/ui';

/**
 * Default list view for sys_role administration.
 * Displays all platform roles with permission summary.
 */
export const RolesView: ListView = {
  name: 'roles',
  label: 'Roles',
  type: 'grid',
  data: {
    provider: 'object',
    object: 'sys_role',
  },
  columns: [
    { field: 'name', label: 'Name', sortable: true },
    { field: 'description', label: 'Description' },
    { field: 'is_system', label: 'System Role' },
    { field: 'created_at', label: 'Created', sortable: true },
  ],
  sort: [{ field: 'created_at', order: 'desc' }],
  filter: [],
  searchableFields: ['name', 'description'],
  pagination: {
    pageSize: 20,
  },
};
