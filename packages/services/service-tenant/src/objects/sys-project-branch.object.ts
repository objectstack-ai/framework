// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_project_branch — Long-lived branch/environment of a project.
 *
 * A project ships through multiple environments (production, staging,
 * preview/PR, ephemeral sandbox). Each branch carries its own physical
 * database connection and its own metadata head, but shares ownership,
 * billing, and access control with the parent `sys_project` row.
 *
 * Cloud-control only. Not present in standalone project DBs.
 *
 * @namespace sys
 */
export const SysProjectBranch = ObjectSchema.create({
  name: 'sys_project_branch',
  label: 'Branch',
  pluralLabel: 'Branches',
  icon: 'git-branch',
  isSystem: true,
  managedBy: 'config',
  description: 'Long-lived branch / environment of a project (prod, staging, preview).',
  displayNameField: 'display_name',
  titleFormat: '{display_name}',
  compactLayout: ['display_name', 'kind', 'status', 'is_default', 'updated_at'],
  userActions: { create: false, edit: true, delete: false, import: false },

  actions: [
    {
      name: 'create_branch',
      label: 'New Branch',
      icon: 'git-branch-plus',
      variant: 'primary',
      type: 'api',
      locations: ['list_toolbar'],
      target: '/api/v1/cloud/branches',
      method: 'POST',
      mode: 'create',
      refreshAfter: true,
      successMessage: 'Branch created.',
      params: [
        { name: 'projectId', label: 'Project ID', type: 'text', required: true, helpText: 'UUID of the parent project.' },
        { name: 'displayName', label: 'Display Name', type: 'text', required: true },
        { name: 'name', label: 'Name (snake_case)', type: 'text', required: true, placeholder: 'staging' },
        {
          name: 'kind',
          label: 'Kind',
          type: 'select',
          required: true,
          defaultValue: 'preview',
          options: [
            { label: 'Production', value: 'production' },
            { label: 'Staging', value: 'staging' },
            { label: 'Preview', value: 'preview' },
            { label: 'Sandbox', value: 'sandbox' },
          ],
        },
        { name: 'sourceRef', label: 'Source Ref (optional)', type: 'text', required: false },
      ],
    },
    {
      name: 'promote_branch',
      label: 'Promote to Production',
      icon: 'arrow-up-circle',
      variant: 'primary',
      type: 'api',
      locations: ['list_item', 'record_header'],
      target: '/api/v1/cloud/branches/{id}/promote',
      method: 'POST',
      recordIdParam: 'id',
      confirmText: 'Promote this branch to production? The current production branch will be demoted.',
      successMessage: 'Branch promoted.',
      refreshAfter: true,
    },
    {
      name: 'pause_branch',
      label: 'Pause',
      icon: 'pause-circle',
      variant: 'secondary',
      type: 'api',
      locations: ['list_item', 'record_header'],
      target: '/api/v1/cloud/branches/{id}/pause',
      method: 'POST',
      recordIdParam: 'id',
      successMessage: 'Branch paused.',
      refreshAfter: true,
    },
    {
      name: 'resume_branch',
      label: 'Resume',
      icon: 'play-circle',
      variant: 'secondary',
      type: 'api',
      locations: ['list_item', 'record_header'],
      target: '/api/v1/cloud/branches/{id}/resume',
      method: 'POST',
      recordIdParam: 'id',
      successMessage: 'Branch resumed.',
      refreshAfter: true,
    },
    {
      name: 'delete_branch',
      label: 'Delete Branch',
      icon: 'trash-2',
      variant: 'danger',
      type: 'api',
      locations: ['list_item', 'record_header'],
      target: '/api/v1/cloud/branches/{id}',
      method: 'DELETE',
      recordIdParam: 'id',
      confirmText: 'Delete this branch? The default branch cannot be deleted.',
      successMessage: 'Branch deleted.',
      refreshAfter: true,
    },
  ],

  listViews: {
    all_branches: {
      type: 'grid',
      name: 'all_branches',
      label: 'All Branches',
      data: { provider: 'object', object: 'sys_project_branch' },
      columns: ['project_id', 'display_name', 'kind', 'status', 'is_default', 'updated_at'],
      sort: [{ field: 'project_id', order: 'asc' }, { field: 'display_name', order: 'asc' }],
      pagination: { pageSize: 50 },
    },
    production: {
      type: 'grid',
      name: 'production',
      label: 'Production',
      data: { provider: 'object', object: 'sys_project_branch' },
      columns: ['project_id', 'display_name', 'status', 'database_driver', 'updated_at'],
      filter: [{ field: 'kind', operator: 'equals', value: 'production' }],
      pagination: { pageSize: 50 },
    },
    preview: {
      type: 'grid',
      name: 'preview',
      label: 'Preview',
      data: { provider: 'object', object: 'sys_project_branch' },
      columns: ['project_id', 'display_name', 'status', 'source_ref', 'updated_at'],
      filter: [{ field: 'kind', operator: 'equals', value: 'preview' }],
      pagination: { pageSize: 50 },
    },
  },

  fields: {
    id: Field.text({ label: 'Branch ID', required: true, readonly: true, group: 'System' }),

    project_id: Field.lookup('sys_project', {
      label: 'Project',
      required: true,
      description: 'Parent project this branch belongs to.',
      group: 'Definition',
    }),

    name: Field.text({
      label: 'Name',
      required: true,
      maxLength: 100,
      description: 'Machine name (snake_case) — unique within project.',
      group: 'Definition',
    }),

    display_name: Field.text({
      label: 'Display Name',
      required: true,
      maxLength: 255,
      group: 'Definition',
    }),

    kind: Field.text({
      label: 'Kind',
      required: true,
      defaultValue: 'preview',
      maxLength: 32,
      description: 'production | staging | preview | sandbox',
      group: 'Definition',
    }),

    is_default: Field.boolean({
      label: 'Default',
      defaultValue: false,
      description: 'One branch per project is marked default (typically production).',
      group: 'Definition',
    }),

    status: Field.text({
      label: 'Status',
      required: true,
      defaultValue: 'active',
      maxLength: 32,
      description: 'active | provisioning | paused | archived | failed',
      group: 'Definition',
    }),

    database_driver: Field.text({
      label: 'Database Driver',
      required: false,
      maxLength: 32,
      description: 'Inherits from parent project when blank.',
      group: 'Storage',
    }),

    database_url: Field.text({
      label: 'Database URL',
      required: false,
      readonly: true,
      hidden: true,
      maxLength: 2048,
      description: 'Physical connection string for this branch. Sensitive — admin only.',
      group: 'Storage',
    }),

    database_auth_token: Field.text({
      label: 'Database Auth Token',
      required: false,
      readonly: true,
      hidden: true,
      maxLength: 2048,
      description: 'Encrypted token (Turso/libSQL) when applicable. Sensitive — admin only.',
      group: 'Storage',
    }),

    source_ref: Field.text({
      label: 'Source Ref',
      required: false,
      maxLength: 255,
      description: 'For preview branches: the git ref / PR identifier this branch shadows.',
      group: 'Definition',
    }),

    created_at: Field.datetime({ label: 'Created At', defaultValue: 'NOW()', readonly: true, group: 'System' }),
    updated_at: Field.datetime({ label: 'Updated At', defaultValue: 'NOW()', readonly: true, group: 'System' }),
  },

  indexes: [
    { fields: ['project_id', 'name'], unique: true },
    { fields: ['project_id', 'is_default'] },
    { fields: ['status'] },
  ],
});
