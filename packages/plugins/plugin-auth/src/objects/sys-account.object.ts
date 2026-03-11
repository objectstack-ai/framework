// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_account — System Account Object
 *
 * OAuth / credential provider account record.
 * Backed by better-auth's `account` model with ObjectStack field conventions.
 *
 * @namespace sys
 */
export const SysAccount = ObjectSchema.create({
  namespace: 'sys',
  name: 'account',
  label: 'Account',
  pluralLabel: 'Accounts',
  icon: 'link',
  isSystem: true,
  description: 'OAuth and authentication provider accounts',
  titleFormat: '{provider_id} - {account_id}',
  compactLayout: ['provider_id', 'user_id', 'account_id'],
  
  fields: {
    id: Field.text({
      label: 'Account ID',
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
    
    provider_id: Field.text({
      label: 'Provider ID',
      required: true,
      description: 'OAuth provider identifier (google, github, etc.)',
    }),
    
    account_id: Field.text({
      label: 'Provider Account ID',
      required: true,
      description: "User's ID in the provider's system",
    }),
    
    user_id: Field.text({
      label: 'User ID',
      required: true,
      description: 'Link to user table',
    }),
    
    access_token: Field.textarea({
      label: 'Access Token',
      required: false,
    }),
    
    refresh_token: Field.textarea({
      label: 'Refresh Token',
      required: false,
    }),
    
    id_token: Field.textarea({
      label: 'ID Token',
      required: false,
    }),
    
    access_token_expires_at: Field.datetime({
      label: 'Access Token Expires At',
      required: false,
    }),
    
    refresh_token_expires_at: Field.datetime({
      label: 'Refresh Token Expires At',
      required: false,
    }),
    
    scope: Field.text({
      label: 'OAuth Scope',
      required: false,
    }),
    
    password: Field.text({
      label: 'Password Hash',
      required: false,
      description: 'Hashed password for email/password provider',
    }),
  },
  
  indexes: [
    { fields: ['user_id'], unique: false },
    { fields: ['provider_id', 'account_id'], unique: true },
  ],
  
  enable: {
    trackHistory: false,
    searchable: false,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: true,
    mru: false,
  },
});
