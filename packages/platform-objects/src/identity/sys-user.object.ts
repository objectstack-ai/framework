// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_user — System User Object
 *
 * Canonical user identity record for the ObjectStack platform.
 * Backed by better-auth's `user` model with ObjectStack field conventions.
 *
 * Field order drives default list/form layout: identity first, then profile,
 * then system-managed audit fields (hidden from create/edit forms).
 *
 * @namespace sys
 */
export const SysUser = ObjectSchema.create({
  name: 'sys_user',
  label: 'User',
  pluralLabel: 'Users',
  icon: 'user',
  isSystem: true,
  description: 'User accounts for authentication',
  displayNameField: 'name',
  titleFormat: '{name}',
  compactLayout: ['name', 'email', 'email_verified'],

  fields: {
    // ── Identity (primary business fields) ───────────────────────
    name: Field.text({
      label: 'Name',
      required: true,
      searchable: true,
      maxLength: 255,
      group: 'Identity',
    }),

    email: Field.email({
      label: 'Email',
      required: true,
      searchable: true,
      group: 'Identity',
    }),

    email_verified: Field.boolean({
      label: 'Email Verified',
      defaultValue: false,
      group: 'Identity',
    }),

    two_factor_enabled: Field.boolean({
      label: 'Two-Factor Enabled',
      defaultValue: false,
      group: 'Identity',
      description: 'Whether two-factor authentication is enabled for this user. Maintained by the better-auth `twoFactor` plugin.',
    }),

    // ── Profile ──────────────────────────────────────────────────
    image: Field.url({
      label: 'Profile Image',
      required: false,
      group: 'Profile',
    }),

    // ── System (auto-managed, hidden from create/edit forms) ─────
    id: Field.text({
      label: 'User ID',
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
    { fields: ['email'], unique: true },
    { fields: ['created_at'], unique: false },
  ],

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: true,
    mru: true,
  },

  validations: [
    {
      name: 'email_unique',
      type: 'unique',
      severity: 'error',
      message: 'Email must be unique',
      fields: ['email'],
      caseSensitive: false,
    },
  ],
});
