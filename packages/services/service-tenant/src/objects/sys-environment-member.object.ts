// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_environment_member — Per-Environment RBAC
 *
 * Grants a user access to a specific environment with a specific role.
 * Scoped narrowly to environment boundaries so that `prod` can have a
 * different cast of admins than `dev`.
 *
 * A user may be a member of multiple environments within the same
 * organization with different roles. Uniqueness is `(environment_id, user_id)`.
 *
 * @namespace sys
 */
export const SysEnvironmentMember = ObjectSchema.create({
  name: 'sys_environment_member',
  label: 'Environment Member',
  pluralLabel: 'Environment Members',
  icon: 'users',
  isSystem: true,
  managedBy: 'config',
  description: 'Per-environment user/role assignments.',
  titleFormat: '{user_id} @ {environment_id}',
  compactLayout: ['user_id', 'environment_id', 'role'],

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

    environment_id: Field.lookup('sys_environment', {
      label: 'Environment',
      required: true,
      description: 'Foreign key to sys_environment.',
    }),

    user_id: Field.lookup('sys_user', {
      label: 'User',
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

    invited_by: Field.lookup('sys_user', {
      label: 'Invited By',
      required: true,
      description: 'User that granted this membership.',
    }),
  },

  indexes: [
    { fields: ['environment_id', 'user_id'], unique: true },
    { fields: ['environment_id'] },
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
