// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_database_credential — Rotatable Database Credentials
 *
 * Stores encrypted credentials for environment databases separately from
 * the environment record (`sys_environment`) so that secrets can
 * be rotated, revoked, and audited independently.
 *
 * During rotation, multiple rows can exist per `environment_id`:
 * the previous credential stays `active` until the new one has been
 * propagated to all runtimes, then flips to `revoked`.
 *
 * @namespace sys
 */
export const SysDatabaseCredential = ObjectSchema.create({
  namespace: 'sys',
  name: 'database_credential',
  label: 'Database Credential',
  pluralLabel: 'Database Credentials',
  icon: 'key',
  isSystem: true,
  description: 'Rotatable encrypted credentials for environment databases.',
  titleFormat: '{id}',
  compactLayout: ['environment_id', 'status', 'authorization', 'expires_at'],

  fields: {
    id: Field.text({
      label: 'Credential ID',
      required: true,
      readonly: true,
      description: 'UUID of the credential.',
    }),

    created_at: Field.datetime({
      label: 'Created At',
      defaultValue: 'NOW()',
      readonly: true,
      description: 'Creation timestamp.',
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      defaultValue: 'NOW()',
      readonly: true,
      description: 'Last update timestamp.',
    }),

    environment_id: Field.text({
      label: 'Environment ID',
      required: true,
      description: 'Foreign key to sys_environment.',
    }),

    secret_ciphertext: Field.textarea({
      label: 'Secret Ciphertext',
      required: true,
      description: 'Encrypted auth token or secret (never store plaintext).',
    }),

    encryption_key_id: Field.text({
      label: 'Encryption Key ID',
      required: true,
      maxLength: 255,
      description: 'KMS/encryption key ID that produced the ciphertext.',
    }),

    authorization: Field.select({
      label: 'Authorization',
      required: true,
      defaultValue: 'full_access',
      description: 'Authorization scope for this credential.',
      options: [
        { value: 'full_access', label: 'Full Access' },
        { value: 'read_only', label: 'Read Only' },
      ],
    }),

    status: Field.select({
      label: 'Status',
      required: true,
      defaultValue: 'active',
      description: 'Credential lifecycle status.',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'rotating', label: 'Rotating' },
        { value: 'revoked', label: 'Revoked' },
      ],
    }),

    expires_at: Field.datetime({
      label: 'Expires At',
      required: false,
      description: 'Optional expiry — after this timestamp the credential must be rotated.',
    }),

    revoked_at: Field.datetime({
      label: 'Revoked At',
      required: false,
      description: 'Timestamp when the credential was revoked (null while active).',
    }),
  },

  indexes: [
    { fields: ['environment_id'] },
    { fields: ['environment_id', 'status'] },
    { fields: ['status'] },
    { fields: ['expires_at'] },
  ],

  enable: {
    trackHistory: true,
    searchable: false,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update'],
    trash: false,
    mru: false,
  },
});
