// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_permission_set — System Permission Set Object
 *
 * Named groupings of fine-grained permissions.
 * Permission sets can be assigned to roles or directly to users
 * for granular access control.
 *
 * @namespace sys
 */
export const SysPermissionSet = ObjectSchema.create({
  namespace: 'sys',
  name: 'permission_set',
  label: 'Permission Set',
  pluralLabel: 'Permission Sets',
  icon: 'lock',
  isSystem: true,
  description: 'Named permission groupings for fine-grained access control',
  titleFormat: '{name}',
  compactLayout: ['name', 'label', 'active'],
  
  fields: {
    id: Field.text({
      label: 'Permission Set ID',
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
      description: 'Unique machine name for the permission set',
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
    
    object_permissions: Field.textarea({
      label: 'Object Permissions',
      required: false,
      description: 'JSON-serialized object-level CRUD permissions',
    }),
    
    field_permissions: Field.textarea({
      label: 'Field Permissions',
      required: false,
      description: 'JSON-serialized field-level read/write permissions',
    }),
    
    active: Field.boolean({
      label: 'Active',
      defaultValue: true,
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
