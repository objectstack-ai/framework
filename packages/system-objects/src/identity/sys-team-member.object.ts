// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_team_member — System Team Member Object
 *
 * Links users to teams within organizations.
 * Backed by better-auth's organization plugin (teams feature).
 *
 * @namespace sys
 */
export const SysTeamMember = ObjectSchema.create({
  name: 'sys_team_member',
  label: 'Team Member',
  pluralLabel: 'Team Members',
  icon: 'user-plus',
  isSystem: true,
  description: 'Team membership records linking users to teams',
  titleFormat: '{user_id} in {team_id}',
  compactLayout: ['user_id', 'team_id', 'created_at'],
  
  fields: {
    id: Field.text({
      label: 'Team Member ID',
      required: true,
      readonly: true,
    }),
    
    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
    }),
    
    team_id: Field.text({
      label: 'Team ID',
      required: true,
    }),
    
    user_id: Field.text({
      label: 'User ID',
      required: true,
    }),
  },
  
  indexes: [
    { fields: ['team_id', 'user_id'], unique: true },
    { fields: ['user_id'] },
  ],
  
  enable: {
    trackHistory: true,
    searchable: false,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'delete'],
    trash: false,
    mru: false,
  },
});
