// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_session — System Session Object
 *
 * Active user session record for the ObjectStack platform.
 * Backed by better-auth's `session` model with ObjectStack field conventions.
 *
 * @namespace sys
 */
export const SysSession = ObjectSchema.create({
  namespace: 'sys',
  name: 'session',
  label: 'Session',
  pluralLabel: 'Sessions',
  icon: 'key',
  isSystem: true,
  description: 'Active user sessions',
  titleFormat: 'Session {token}',
  compactLayout: ['user_id', 'expires_at', 'ip_address'],
  
  fields: {
    id: Field.text({
      label: 'Session ID',
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
    
    expires_at: Field.datetime({
      label: 'Expires At',
      required: true,
    }),
    
    token: Field.text({
      label: 'Session Token',
      required: true,
    }),
    
    ip_address: Field.text({
      label: 'IP Address',
      required: false,
      maxLength: 45, // Support IPv6
    }),
    
    user_agent: Field.textarea({
      label: 'User Agent',
      required: false,
    }),

    active_organization_id: Field.text({
      label: 'Active Organization ID',
      required: false,
    }),

    active_team_id: Field.text({
      label: 'Active Team ID',
      required: false,
    }),
  },
  
  indexes: [
    { fields: ['token'], unique: true },
    { fields: ['user_id'], unique: false },
    { fields: ['expires_at'], unique: false },
  ],
  
  enable: {
    trackHistory: false,
    searchable: false,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'delete'],
    trash: false,
    mru: false,
  },
});
