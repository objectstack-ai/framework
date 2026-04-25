// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_member — System Member Object
 *
 * Organization membership linking users to organizations with roles.
 * Backed by better-auth's organization plugin.
 *
 * @namespace sys
 */
export const SysMember = ObjectSchema.create({
  name: 'sys_member',
  label: 'Member',
  pluralLabel: 'Members',
  icon: 'user-check',
  isSystem: true,
  description: 'Organization membership records',
  titleFormat: '{user_id} in {organization_id}',
  compactLayout: ['user_id', 'organization_id', 'role'],
  
  fields: {
    id: Field.text({
      label: 'Member ID',
      required: true,
      readonly: true,
    }),
    
    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
    }),
    
    organization_id: Field.text({
      label: 'Organization ID',
      required: true,
    }),
    
    user_id: Field.text({
      label: 'User ID',
      required: true,
    }),
    
    role: Field.text({
      label: 'Role',
      required: false,
      description: 'Member role within the organization (e.g. admin, member)',
      maxLength: 100,
    }),
  },
  
  indexes: [
    { fields: ['organization_id', 'user_id'], unique: true },
    { fields: ['user_id'] },
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
