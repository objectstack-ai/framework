// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_tenant_database — Global Tenant Registry Object
 *
 * @deprecated v4.x deprecation shim — superseded by the
 * environment-per-database isolation model. New deployments should use
 * `sys_environment` + `sys_environment_database` + `sys_database_credential`.
 * This object is kept for backwards compatibility with existing v4.x
 * tenants and will be **removed in v5.0** together with the associated
 * migration in `migrations/v4-to-v5-env-migration.ts`. See
 * `docs/adr/0002-environment-database-isolation.md`.
 *
 * Stores tenant database information in the global control plane.
 * Each tenant has its own isolated Turso database with UUID-based naming.
 *
 * @namespace sys
 */
export const SysTenantDatabase = ObjectSchema.create({
  name: 'sys_tenant_database',
  label: 'Tenant Database',
  pluralLabel: 'Tenant Databases',
  icon: 'database',
  isSystem: true,
  description: 'Tenant database registry for multi-tenant architecture',
  titleFormat: '{database_name}',
  compactLayout: ['database_name', 'organization_id', 'status', 'plan'],

  fields: {
    id: Field.text({
      label: 'Tenant ID',
      required: true,
      readonly: true,
      description: 'UUID-based tenant identifier',
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

    organization_id: Field.text({
      label: 'Organization ID',
      required: true,
      description: 'Foreign key to sys_organization',
    }),

    database_name: Field.text({
      label: 'Database Name',
      required: true,
      maxLength: 255,
      description: 'UUID-based database name (immutable)',
    }),

    database_url: Field.url({
      label: 'Database URL',
      required: true,
      description: 'Full database connection URL (e.g., libsql://{uuid}.turso.io)',
    }),

    auth_token: Field.text({
      label: 'Auth Token',
      required: true,
      maxLength: 2000,
      description: 'Encrypted database-specific auth token',
    }),

    status: Field.select({
      label: 'Status',
      required: true,
      options: [
        { value: 'provisioning', label: 'Provisioning' },
        { value: 'active', label: 'Active' },
        { value: 'suspended', label: 'Suspended' },
        { value: 'archived', label: 'Archived' },
        { value: 'failed', label: 'Failed' },
      ],
      defaultValue: 'provisioning',
    }),

    region: Field.text({
      label: 'Region',
      required: true,
      maxLength: 100,
      description: 'Deployment region (e.g., us-east-1, eu-west-1)',
    }),

    plan: Field.select({
      label: 'Plan',
      required: true,
      options: [
        { value: 'free', label: 'Free' },
        { value: 'starter', label: 'Starter' },
        { value: 'pro', label: 'Pro' },
        { value: 'enterprise', label: 'Enterprise' },
        { value: 'custom', label: 'Custom' },
      ],
      defaultValue: 'free',
    }),

    storage_limit_mb: Field.number({
      label: 'Storage Limit (MB)',
      required: true,
      defaultValue: 1024,
      description: 'Maximum storage allowed in megabytes',
    }),

    last_accessed_at: Field.datetime({
      label: 'Last Accessed At',
      required: false,
      description: 'Last time the tenant database was accessed',
    }),

    metadata: Field.textarea({
      label: 'Metadata',
      required: false,
      description: 'JSON-serialized custom tenant configuration',
    }),
  },

  indexes: [
    { fields: ['database_name'], unique: true },
    { fields: ['organization_id'] },
    { fields: ['status'] },
    { fields: ['plan'] },
  ],

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update'],
    trash: false, // Don't allow soft delete - use archive instead
    mru: true,
  },
});
