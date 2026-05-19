// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_two_factor — System Two-Factor Object
 *
 * Two-factor authentication credentials (TOTP, backup codes).
 * Backed by better-auth's two-factor plugin.
 *
 * @namespace sys
 */
export const SysTwoFactor = ObjectSchema.create({
  name: 'sys_two_factor',
  label: 'Two Factor',
  pluralLabel: 'Two Factor Credentials',
  icon: 'smartphone',
  isSystem: true,
  managedBy: 'better-auth',
  description: 'Two-factor authentication credentials',
  titleFormat: 'Two-factor for {user_id}',
  compactLayout: ['user_id', 'created_at'],

  listViews: {
    mine: {
      type: 'grid',
      name: 'mine',
      label: 'My Enrollment',
      data: { provider: 'object', object: 'sys_two_factor' },
      columns: ['created_at', 'updated_at'],
      filter: [{ field: 'user_id', operator: 'equals', value: '{current_user_id}' }],
      sort: [{ field: 'created_at', order: 'desc' }],
      pagination: { pageSize: 50 },
    },
    all_enrollments: {
      type: 'grid',
      name: 'all_enrollments',
      label: 'All',
      data: { provider: 'object', object: 'sys_two_factor' },
      columns: ['user_id', 'created_at', 'updated_at'],
      sort: [{ field: 'created_at', order: 'desc' }],
      pagination: { pageSize: 50 },
    },
  },
  
  fields: {
    id: Field.text({
      label: 'Two Factor ID',
      required: true,
      readonly: true,
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
    
    user_id: Field.lookup('sys_user', {
      label: 'User',
      required: true,
    }),
    
    secret: Field.text({
      label: 'Secret',
      required: true,
      description: 'TOTP secret key',
    }),
    
    backup_codes: Field.textarea({
      label: 'Backup Codes',
      required: false,
      description: 'JSON-serialized backup recovery codes',
    }),
  },
  
  indexes: [
    { fields: ['user_id'], unique: true },
  ],
  
  enable: {
    trackHistory: false,
    searchable: false,
    apiEnabled: true,
    apiMethods: ['get', 'create', 'update', 'delete'],
    trash: false,
    mru: false,
  },
});
