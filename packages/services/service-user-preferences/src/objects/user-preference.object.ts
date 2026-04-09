// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * user_preferences — User Preferences Object
 *
 * Stores user-specific preferences and configuration.
 * Supports both scalar values (theme, locale) and structured data (favorites, recent_items).
 *
 * @namespace identity
 */
export const UserPreferenceObject = ObjectSchema.create({
  namespace: 'identity',
  name: 'user_preferences',
  label: 'User Preference',
  pluralLabel: 'User Preferences',
  icon: 'settings',
  isSystem: true,
  description: 'User-specific preferences and configuration',

  fields: {
    id: Field.text({
      label: 'Preference ID',
      required: true,
      readonly: true,
    }),

    user_id: Field.text({
      label: 'User ID',
      required: true,
      maxLength: 255,
      description: 'User who owns this preference',
    }),

    key: Field.text({
      label: 'Key',
      required: true,
      maxLength: 255,
      description: 'Preference key (well-known or custom, e.g., theme, locale, plugin.ai.auto_save)',
    }),

    value: Field.textarea({
      label: 'Value',
      required: false,
      description: 'JSON-serialized preference value',
    }),

    value_type: Field.select({
      label: 'Value Type',
      required: false,
      options: [
        { label: 'String', value: 'string' },
        { label: 'Number', value: 'number' },
        { label: 'Boolean', value: 'boolean' },
        { label: 'Object', value: 'object' },
        { label: 'Array', value: 'array' },
        { label: 'Null', value: 'null' },
      ],
      description: 'Type hint for client-side type safety',
    }),

    created_at: Field.datetime({
      label: 'Created At',
      required: true,
      defaultValue: 'NOW()',
      readonly: true,
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      required: true,
      defaultValue: 'NOW()',
      readonly: true,
    }),
  },

  indexes: [
    // Primary lookup: user_id + key (unique composite)
    { fields: ['user_id', 'key'], unique: true },
    // Secondary lookup: user_id alone (for getAll)
    { fields: ['user_id'] },
    // Timestamp ordering
    { fields: ['created_at'] },
  ],

  enable: {
    trackHistory: false,
    searchable: false,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: false,
    mru: false,
  },
});
