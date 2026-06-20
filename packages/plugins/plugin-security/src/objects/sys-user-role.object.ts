// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_user_role — User ↔ Role assignment (ADR-0057 D4).
 *
 * The platform-owned source of truth for "who holds which RBAC role",
 * decoupled from better-auth's `sys_member.role` (which is reframed to
 * org-administration: owner/admin/member). At request time the runtime
 * resolver (`resolveExecutionContext`) reads assignments from this table
 * (∪ `sys_member.role` during the transition window) into
 * `ExecutionContext.roles[]`.
 *
 * `role` stores the role's machine name (matches `sys_role.name`), mirroring
 * how `ctx.roles` is keyed everywhere downstream. `organization_id = null`
 * means a cross-tenant (global) assignment.
 *
 * @namespace sys
 */
export const SysUserRole = ObjectSchema.create({
  name: 'sys_user_role',
  label: 'User Role',
  pluralLabel: 'User Roles',
  icon: 'user-cog',
  isSystem: true,
  managedBy: 'system',
  description: 'Assigns an RBAC role (sys_role.name) to a user. Platform-owned (ADR-0057 D4).',
  titleFormat: '{user_id} → {role}',
  compactLayout: ['user_id', 'role', 'organization_id'],

  fields: {
    id: Field.text({
      label: 'Assignment ID',
      required: true,
      readonly: true,
      description: 'UUID of the user-role assignment.',
    }),

    user_id: Field.lookup('sys_user', {
      label: 'User',
      required: true,
      description: 'Foreign key to sys_user.',
    }),

    role: Field.text({
      label: 'Role',
      required: true,
      maxLength: 100,
      description: 'RBAC role machine name (references sys_role.name).',
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
    { fields: ['user_id', 'role', 'organization_id'], unique: true },
    { fields: ['user_id'] },
    { fields: ['role'] },
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
