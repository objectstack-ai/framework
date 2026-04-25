// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_session — System Session Object
 *
 * Active user session record for the ObjectStack platform.
 * Backed by better-auth's `session` model with ObjectStack field conventions.
 *
 * The `token` field is hidden by default — sessions are managed by the
 * auth plugin, not edited manually. Admins see session metadata
 * (user, expiry, IP, active context) without exposing the token value.
 *
 * @namespace sys
 */
export const SysSession = ObjectSchema.create({
  name: 'sys_session',
  label: 'Session',
  pluralLabel: 'Sessions',
  icon: 'key',
  isSystem: true,
  description: 'Active user sessions',
  displayNameField: 'user_id',
  titleFormat: 'Session — {user_id}',
  compactLayout: ['user_id', 'ip_address', 'expires_at'],

  fields: {
    // ── Session owner & expiry ──────────────────────────────────
    user_id: Field.text({
      label: 'User',
      required: true,
      searchable: true,
      group: 'Session',
    }),

    expires_at: Field.datetime({
      label: 'Expires At',
      required: true,
      group: 'Session',
    }),

    // ── Active context (multi-org/team) ──────────────────────────
    active_organization_id: Field.text({
      label: 'Active Organization',
      required: false,
      group: 'Context',
    }),

    active_team_id: Field.text({
      label: 'Active Team',
      required: false,
      group: 'Context',
    }),

    // ── Client fingerprint ───────────────────────────────────────
    ip_address: Field.text({
      label: 'IP Address',
      required: false,
      maxLength: 45, // Support IPv6
      group: 'Client',
    }),

    user_agent: Field.textarea({
      label: 'User Agent',
      required: false,
      group: 'Client',
    }),

    // ── Secret (hidden by default) ──────────────────────────────
    token: Field.text({
      label: 'Session Token',
      required: true,
      hidden: true,
      readonly: true,
      description: 'Opaque session token — never exposed in UI',
      group: 'Secret',
    }),

    // ── System ───────────────────────────────────────────────────
    id: Field.text({
      label: 'Session ID',
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
    { fields: ['token'], unique: true },
    { fields: ['user_id'], unique: false },
    { fields: ['expires_at'], unique: false },
  ],

  enable: {
    trackHistory: false,
    searchable: false,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'delete'],
    trash: false,
    mru: false,
    clone: false,
  },
});
