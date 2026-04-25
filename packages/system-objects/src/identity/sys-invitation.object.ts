// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_invitation — System Invitation Object
 *
 * Organization invitation tokens for inviting users.
 * Backed by better-auth's organization plugin.
 *
 * @namespace sys
 */
export const SysInvitation = ObjectSchema.create({
  name: 'sys_invitation',
  label: 'Invitation',
  pluralLabel: 'Invitations',
  icon: 'mail',
  isSystem: true,
  description: 'Organization invitations for user onboarding',
  titleFormat: 'Invitation to {organization_id}',
  compactLayout: ['email', 'organization_id', 'status'],
  
  fields: {
    id: Field.text({
      label: 'Invitation ID',
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
    
    email: Field.email({
      label: 'Email',
      required: true,
      description: 'Email address of the invited user',
    }),
    
    role: Field.text({
      label: 'Role',
      required: false,
      maxLength: 100,
      description: 'Role to assign upon acceptance',
    }),
    
    status: Field.select(['pending', 'accepted', 'rejected', 'expired', 'canceled'], {
      label: 'Status',
      required: true,
      defaultValue: 'pending',
    }),
    
    inviter_id: Field.text({
      label: 'Inviter ID',
      required: true,
      description: 'User ID of the person who sent the invitation',
    }),
    
    expires_at: Field.datetime({
      label: 'Expires At',
      required: true,
    }),
    
    team_id: Field.text({
      label: 'Team ID',
      required: false,
      description: 'Optional team to assign upon acceptance',
    }),
  },
  
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['email'] },
    { fields: ['expires_at'] },
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
