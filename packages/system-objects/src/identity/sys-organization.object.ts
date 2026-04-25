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
  name: 'sys_organization',
  label: 'Organization',
  pluralLabel: 'Organizations',
  icon: 'building-2',
  isSystem: true,
  description: 'Organizations for multi-tenant grouping',
  displayNameField: 'name',
  titleFormat: '{name}',
  compactLayout: ['name', 'slug'],

  fields: {
    // ── Identity ─────────────────────────────────────────────────
    name: Field.text({
      label: 'Name',
      required: true,
      searchable: true,
      maxLength: 255,
      group: 'Identity',
    }),

    slug: Field.text({
      label: 'Slug',
      required: false,
      searchable: true,
      maxLength: 255,
      description: 'URL-friendly identifier',
      group: 'Identity',
    }),

    // ── Branding ─────────────────────────────────────────────────
    logo: Field.url({
      label: 'Logo',
      required: false,
      group: 'Branding',
    }),

    // ── Configuration ────────────────────────────────────────────
    metadata: Field.textarea({
      label: 'Metadata',
      required: false,
      description: 'JSON-serialized organization metadata',
      group: 'Configuration',
    }),

    // ── System ───────────────────────────────────────────────────
    id: Field.text({
      label: 'Organization ID',
      required: true,
      readonly: true,
      group: 'System',
    }),

    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
      group: 'System',
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      defaultValue: 'NOW()',
      readonly: true,
      group: 'System',
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
