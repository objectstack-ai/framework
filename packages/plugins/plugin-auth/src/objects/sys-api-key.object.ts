// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_api_key — System API Key Object
 *
 * API keys for programmatic/machine access to the platform.
 *
 * @namespace sys
 */
export const SysApiKey = ObjectSchema.create({
  namespace: 'sys',
  name: 'api_key',
  label: 'API Key',
  pluralLabel: 'API Keys',
  icon: 'key-round',
  isSystem: true,
  description: 'API keys for programmatic access',
  titleFormat: '{name}',
  compactLayout: ['name', 'user_id', 'expires_at'],
  
  fields: {
    id: Field.text({
      label: 'API Key ID',
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
    
    name: Field.text({
      label: 'Name',
      required: true,
      maxLength: 255,
      description: 'Human-readable label for the API key',
    }),
    
    key: Field.text({
      label: 'Key',
      required: true,
      description: 'Hashed API key value',
    }),
    
    prefix: Field.text({
      label: 'Prefix',
      required: false,
      maxLength: 16,
      description: 'Visible prefix for identifying the key (e.g., "osk_")',
    }),
    
    user_id: Field.text({
      label: 'User ID',
      required: true,
      description: 'Owner user of this API key',
    }),
    
    scopes: Field.textarea({
      label: 'Scopes',
      required: false,
      description: 'JSON array of permission scopes',
    }),
    
    expires_at: Field.datetime({
      label: 'Expires At',
      required: false,
    }),
    
    last_used_at: Field.datetime({
      label: 'Last Used At',
      required: false,
    }),
    
    revoked: Field.boolean({
      label: 'Revoked',
      defaultValue: false,
    }),
  },
  
  indexes: [
    { fields: ['key'], unique: true },
    { fields: ['user_id'] },
    { fields: ['prefix'] },
  ],
  
  enable: {
    trackHistory: true,
    searchable: false,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: false,
    mru: false,
  },
});
