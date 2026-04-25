// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_team — System Team Object
 *
 * Teams within an organization for fine-grained grouping.
 * Backed by better-auth's organization plugin (teams feature).
 *
 * @namespace sys
 */
export const SysTeam = ObjectSchema.create({
  name: 'sys_team',
  label: 'Team',
  pluralLabel: 'Teams',
  icon: 'users',
  isSystem: true,
  description: 'Teams within organizations for fine-grained grouping',
  displayNameField: 'name',
  titleFormat: '{name}',
  compactLayout: ['name', 'organization_id'],

  fields: {
    // ── Identity ─────────────────────────────────────────────────
    name: Field.text({
      label: 'Name',
      required: true,
      searchable: true,
      maxLength: 255,
      group: 'Identity',
    }),

    organization_id: Field.text({
      label: 'Organization',
      required: true,
      description: 'Parent organization for this team',
      group: 'Identity',
    }),

    // ── System ───────────────────────────────────────────────────
    id: Field.text({
      label: 'Team ID',
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
    { fields: ['organization_id'] },
    { fields: ['name', 'organization_id'], unique: true },
  ],

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: true,
    mru: false,
  },
});
