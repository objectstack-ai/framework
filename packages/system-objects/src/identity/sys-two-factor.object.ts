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
  description: 'Two-factor authentication credentials',
  titleFormat: 'Two-factor for {user_id}',
  compactLayout: ['user_id', 'created_at'],
  
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
    
    user_id: Field.text({
      label: 'User ID',
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
