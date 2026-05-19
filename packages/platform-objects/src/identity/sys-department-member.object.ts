// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_department_member — User ↔ Department Assignment
 *
 * Many-to-many between `sys_user` and `sys_department`. A user can belong
 * to multiple departments (matrix orgs) but exactly one is marked
 * `is_primary` to drive the default reporting view.
 *
 * Effective-dated so that historical reports & audits can reconstruct
 * who reported to which unit at any point in time.
 *
 * @namespace sys
 */
export const SysDepartmentMember = ObjectSchema.create({
  name: 'sys_department_member',
  label: 'Department Member',
  pluralLabel: 'Department Members',
  icon: 'user-cog',
  isSystem: true,
  managedBy: 'platform',
  description: 'User assignment to a department (matrix-org friendly, effective-dated).',
  titleFormat: '{user_id} in {department_id}',
  compactLayout: ['user_id', 'department_id', 'role_in_department', 'is_primary'],

  fields: {
    id: Field.text({
      label: 'Member ID',
      required: true,
      readonly: true,
      group: 'System',
    }),

    department_id: Field.lookup('sys_department', {
      label: 'Department',
      required: true,
      group: 'Assignment',
    }),

    user_id: Field.lookup('sys_user', {
      label: 'User',
      required: true,
      group: 'Assignment',
    }),

    role_in_department: Field.select(
      ['member', 'lead', 'deputy'],
      {
        label: 'Role in Department',
        required: false,
        defaultValue: 'member',
        description: '`lead` is the day-to-day head; `deputy` may stand in for the lead in approval routing.',
        group: 'Assignment',
      },
    ),

    is_primary: Field.boolean({
      label: 'Primary Assignment',
      required: false,
      defaultValue: true,
      description: 'When the user is in multiple departments, this marks the canonical one for reporting.',
      group: 'Assignment',
    }),

    effective_from: Field.datetime({
      label: 'Effective From',
      required: false,
      group: 'Lifecycle',
    }),

    effective_to: Field.datetime({
      label: 'Effective To',
      required: false,
      group: 'Lifecycle',
    }),

    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
      group: 'System',
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      defaultValue: 'NOW()',
      readonly: true,
      group: 'System',
    }),
  },

  indexes: [
    { fields: ['department_id', 'user_id'], unique: true },
    { fields: ['user_id'] },
    { fields: ['is_primary'] },
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
