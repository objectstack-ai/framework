// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_user_position — User ↔ Role assignment (ADR-0057 D4).
 *
 * The platform-owned source of truth for "who holds which position"
 * (ADR-0090 D3; formerly sys_user_role), decoupled from better-auth's
 * `sys_member.role` (org-administration: owner/admin/member). At request
 * time the runtime resolver (`resolveExecutionContext`) reads assignments
 * from this table (∪ `sys_member.role` during the transition window) into
 * `ExecutionContext.positions[]`.
 *
 * `position` stores the position's machine name (matches
 * `sys_position.name`), mirroring how `ctx.positions` is keyed everywhere
 * downstream. `organization_id = null` means a cross-tenant (global)
 * assignment.
 *
 * @namespace sys
 */
export const SysUserRole = ObjectSchema.create({
  name: 'sys_user_position',
  label: 'User Role',
  pluralLabel: 'User Roles',
  icon: 'user-cog',
  isSystem: true,
  managedBy: 'system',
  description: 'Assigns a position (sys_position.name) to a user. Platform-owned (ADR-0057 D4, ADR-0090 D3).',
  titleFormat: '{user_id} → {position}',
  highlightFields: ['user_id', 'position', 'organization_id'],

  fields: {
    id: Field.text({
      label: 'Assignment ID',
      required: true,
      readonly: true,
      description: 'UUID of the user-position assignment.',
    }),

    user_id: Field.lookup('sys_user', {
      label: 'User',
      required: true,
      description: 'Foreign key to sys_user.',
    }),

    position: Field.text({
      label: 'Role',
      required: true,
      maxLength: 100,
      description: 'Position machine name (references sys_position.name).',
    }),

    organization_id: Field.lookup('sys_organization', {
      label: 'Organization',
      required: false,
      description: 'Tenant that owns this assignment; null = global (cross-tenant).',
    }),

    granted_by: Field.lookup('sys_user', {
      label: 'Granted By',
      required: false,
      description: 'User who granted this role assignment.',
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
    { fields: ['user_id', 'position', 'organization_id'], unique: true },
    { fields: ['user_id'] },
    { fields: ['position'] },
    { fields: ['organization_id'] },
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
