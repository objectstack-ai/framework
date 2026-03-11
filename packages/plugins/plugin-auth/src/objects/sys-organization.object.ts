// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_organization — System Organization Object
 *
 * Multi-organization support for the ObjectStack platform.
 * Backed by better-auth's organization plugin.
 *
 * @namespace sys
 */
export const SysOrganization = ObjectSchema.create({
  namespace: 'sys',
  name: 'organization',
  label: 'Organization',
  pluralLabel: 'Organizations',
  icon: 'building-2',
  isSystem: true,
  description: 'Organizations for multi-tenant grouping',
  titleFormat: '{name}',
  compactLayout: ['name', 'slug', 'created_at'],
  
  fields: {
    id: Field.text({
      label: 'Organization ID',
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
      searchable: true,
      maxLength: 255,
    }),
    
    slug: Field.text({
      label: 'Slug',
      required: false,
      maxLength: 255,
      description: 'URL-friendly identifier',
    }),
    
    logo: Field.url({
      label: 'Logo',
      required: false,
    }),
    
    metadata: Field.textarea({
      label: 'Metadata',
      required: false,
      description: 'JSON-serialized organization metadata',
    }),
  },
  
  indexes: [
    { fields: ['slug'], unique: true },
    { fields: ['name'] },
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
