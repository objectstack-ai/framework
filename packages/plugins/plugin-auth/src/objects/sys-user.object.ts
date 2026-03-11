// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_user — System User Object
 *
 * Canonical user identity record for the ObjectStack platform.
 * Backed by better-auth's `user` model with ObjectStack field conventions.
 *
 * @namespace sys
 */
export const SysUser = ObjectSchema.create({
  namespace: 'sys',
  name: 'user',
  label: 'User',
  pluralLabel: 'Users',
  icon: 'user',
  isSystem: true,
  description: 'User accounts for authentication',
  titleFormat: '{name} ({email})',
  compactLayout: ['name', 'email', 'email_verified'],
  
  fields: {
    id: Field.text({
      label: 'User ID',
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
    
    email: Field.email({
      label: 'Email',
      required: true,
      searchable: true,
    }),
    
    email_verified: Field.boolean({
      label: 'Email Verified',
      defaultValue: false,
    }),
    
    name: Field.text({
      label: 'Name',
      required: true,
      searchable: true,
      maxLength: 255,
    }),
    
    image: Field.url({
      label: 'Profile Image',
      required: false,
    }),
  },
  
  indexes: [
    { fields: ['email'], unique: true },
    { fields: ['created_at'], unique: false },
  ],
  
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: true,
    mru: true,
  },
  
  validations: [
    {
      name: 'email_unique',
      type: 'unique',
      severity: 'error',
      message: 'Email must be unique',
      fields: ['email'],
      caseSensitive: false,
    },
  ],
});
