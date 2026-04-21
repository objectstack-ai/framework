// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_project_member — Per-Project RBAC
 *
 * Grants a user access to a specific project with a specific role.
 * Scoped narrowly to project boundaries so that `prod` can have a
 * different cast of admins than `dev`.
 *
 * A user may be a member of multiple projects within the same
 * organization with different roles. Uniqueness is `(project_id, user_id)`.
 *
 * @namespace sys
 */
export const SysProjectMember = ObjectSchema.create({
  namespace: 'sys',
  name: 'project_member',
  label: 'Project Member',
  pluralLabel: 'Project Members',
  icon: 'users',
  isSystem: true,
  description: 'Per-project user/role assignments.',
  titleFormat: '{user_id} @ {project_id}',
  compactLayout: ['user_id', 'project_id', 'role'],

  fields: {
    id: Field.text({
      label: 'Membership ID',
      required: true,
      readonly: true,
      description: 'UUID of the membership.',
    }),

    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
      description: 'Creation timestamp.',
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      defaultValue: 'NOW()',
      readonly: true,
      description: 'Last update timestamp.',
    }),

    project_id: Field.text({
      label: 'Project ID',
      required: true,
      description: 'Foreign key to sys_project.',
    }),

    user_id: Field.text({
      label: 'User ID',
      required: true,
      description: 'Foreign key to sys_user.',
    }),

    role: Field.select({
      label: 'Role',
      required: true,
      description: 'Per-project role (owner/admin/maker/reader/guest).',
      options: [
        { value: 'owner', label: 'Owner' },
        { value: 'admin', label: 'Administrator' },
        { value: 'maker', label: 'Maker / Developer' },
        { value: 'reader', label: 'Reader' },
        { value: 'guest', label: 'Guest' },
      ],
    }),

    invited_by: Field.text({
      label: 'Invited By',
      required: true,
      description: 'User ID that granted this membership.',
    }),
  },

  indexes: [
    { fields: ['project_id', 'user_id'], unique: true },
    { fields: ['project_id'] },
    { fields: ['user_id'] },
    { fields: ['role'] },
  ],

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: true,
    mru: false,
  },
});
