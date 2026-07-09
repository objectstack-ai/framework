// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_position_permission_set — Role ↔ PermissionSet binding.
 *
 * Allows administrators to compose a `sys_position` from one or more
 * `sys_permission_set` rows. At request time, the runtime resolver
 * (`resolveExecutionContext`) collects every permission set bound to
 * the user's positions via this table and injects their names into
 * `ExecutionContext.permissions[]` for downstream RBAC evaluation.
 *
 * @namespace sys
 */
export const SysRolePermissionSet = ObjectSchema.create({
  name: 'sys_position_permission_set',
  label: 'Role Permission Set',
  pluralLabel: 'Role Permission Sets',
  icon: 'shield-plus',
  isSystem: true,
  managedBy: 'system',
  description: 'Binds a permission set to a position.',
  titleFormat: '{position_id} → {permission_set_id}',
  highlightFields: ['position_id', 'permission_set_id'],

  fields: {
    id: Field.text({
      label: 'Binding ID',
      required: true,
      readonly: true,
      description: 'UUID of the position-permission-set binding.',
    }),

    position_id: Field.lookup('sys_position', {
      label: 'Role',
      required: true,
      description: 'Foreign key to sys_position.',
    }),

    permission_set_id: Field.lookup('sys_permission_set', {
      label: 'Permission Set',
      required: true,
      description: 'Foreign key to sys_permission_set.',
    }),

    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      defaultValue: 'NOW()',
      readonly: true,
    }),
  },

  indexes: [
    { fields: ['position_id', 'permission_set_id'], unique: true },
    { fields: ['position_id'] },
    { fields: ['permission_set_id'] },
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
