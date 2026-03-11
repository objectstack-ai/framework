// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_role — System Role Object
 *
 * RBAC role definition for the ObjectStack platform.
 * Roles group permissions and are assigned to users or members.
 *
 * @namespace sys
 */
export const SysRole = ObjectSchema.create({
  namespace: 'sys',
  name: 'role',
  label: 'Role',
  pluralLabel: 'Roles',
  icon: 'shield',
  isSystem: true,
  description: 'Role definitions for RBAC access control',
  titleFormat: '{name}',
  compactLayout: ['name', 'label', 'active'],
  
  fields: {
    id: Field.text({
      label: 'Role ID',
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
      label: 'API Name',
      required: true,
      searchable: true,
      maxLength: 100,
      description: 'Unique machine name for the role (e.g. admin, editor, viewer)',
    }),
    
    label: Field.text({
      label: 'Display Name',
      required: true,
      maxLength: 255,
    }),
    
    description: Field.textarea({
      label: 'Description',
      required: false,
    }),
    
    permissions: Field.textarea({
      label: 'Permissions',
      required: false,
      description: 'JSON-serialized array of permission strings',
    }),
    
    active: Field.boolean({
      label: 'Active',
      defaultValue: true,
    }),
    
    is_default: Field.boolean({
      label: 'Default Role',
      defaultValue: false,
      description: 'Automatically assigned to new users',
    }),
  },
  
  indexes: [
    { fields: ['name'], unique: true },
    { fields: ['active'] },
  ],
  
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: true,
    mru: true,
  },
});
