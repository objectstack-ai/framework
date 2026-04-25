// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_api_key — System API Key Object
 *
 * API keys for programmatic/machine access to the platform.
 *
 * Field `key` stores a hashed value and is marked hidden so it never
 * leaks into default list/form rendering; the raw token is only
 * returned once on creation via the auth plugin API.
 *
 * @namespace sys
 */
export const SysApiKey = ObjectSchema.create({
  name: 'sys_api_key',
  label: 'API Key',
  pluralLabel: 'API Keys',
  icon: 'key-round',
  isSystem: true,
  description: 'API keys for programmatic access',
  displayNameField: 'name',
  titleFormat: '{name}',
  compactLayout: ['name', 'prefix', 'user_id', 'expires_at', 'revoked'],

  fields: {
    // ── Identity ─────────────────────────────────────────────────
    name: Field.text({
      label: 'Name',
      required: true,
      searchable: true,
      maxLength: 255,
      description: 'Human-readable label for the API key',
      group: 'Identity',
    }),

    prefix: Field.text({
      label: 'Prefix',
      required: false,
      maxLength: 16,
      description: 'Visible prefix for identifying the key (e.g., "osk_")',
      group: 'Identity',
    }),

    user_id: Field.text({
      label: 'Owner',
      required: true,
      description: 'User who owns this API key',
      group: 'Identity',
    }),

    // ── Access ───────────────────────────────────────────────────
    scopes: Field.textarea({
      label: 'Scopes',
      required: false,
      description: 'JSON array of permission scopes',
      group: 'Access',
    }),

    // ── Lifecycle ────────────────────────────────────────────────
    expires_at: Field.datetime({
      label: 'Expires At',
      required: false,
      group: 'Lifecycle',
    }),

    last_used_at: Field.datetime({
      label: 'Last Used At',
      required: false,
      readonly: true,
      description: 'Automatically updated on each API call',
      group: 'Lifecycle',
    }),

    revoked: Field.boolean({
      label: 'Revoked',
      defaultValue: false,
      group: 'Lifecycle',
    }),

    // ── Secret (hidden by default) ──────────────────────────────
    key: Field.text({
      label: 'Hashed Key',
      required: true,
      hidden: true,
      readonly: true,
      description: 'Hashed API key value — never exposed to clients',
      group: 'Secret',
    }),

    // ── System ───────────────────────────────────────────────────
    id: Field.text({
      label: 'API Key ID',
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
    { fields: ['key'], unique: true },
    { fields: ['user_id'] },
    { fields: ['prefix'] },
    { fields: ['revoked'] },
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
