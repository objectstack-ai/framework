// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ListView } from '@objectstack/spec/ui';

/**
 * Default list view for sys_package_installation administration.
 * Displays package installations with version and status information.
 */
export const PackageInstallationsView: ListView = {
  name: 'package_installations',
  label: 'Package Installations',
  type: 'grid',
  data: {
    provider: 'object',
    object: 'sys_package_installation',
  },
  columns: [
    { field: 'package_id', label: 'Package', sortable: true },
    { field: 'project_id', label: 'Project', sortable: true },
    { field: 'package_version_id', label: 'Version' },
    { field: 'status', label: 'Status', sortable: true },
    { field: 'installed_at', label: 'Installed', sortable: true },
  ],
  sort: [{ field: 'installed_at', order: 'desc' }],
  filter: [],
  searchableFields: ['package_id', 'project_id'],
  pagination: {
    pageSize: 20,
  },
};
