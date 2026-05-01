// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ListView } from '@objectstack/spec/ui';

/**
 * Default list view for sys_organization administration.
 * Displays all organizations with key metadata.
 */
export const OrganizationsView: ListView = {
  name: 'organizations',
  label: 'Organizations',
  type: 'grid',
  data: {
    provider: 'object',
    object: 'sys_organization',
  },
  columns: [
    { field: 'name', label: 'Name', sortable: true },
    { field: 'status', label: 'Status', sortable: true },
    { field: 'plan_tier', label: 'Plan Tier' },
    { field: 'member_count', label: 'Members' },
    { field: 'created_at', label: 'Created', sortable: true },
  ],
  sort: [{ field: 'created_at', order: 'desc' }],
  filter: [],
  searchableFields: ['name'],
  pagination: {
    pageSize: 20,
  },
};
