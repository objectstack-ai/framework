// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_environment — Control Plane Environment Registry
 *
 * One row per environment. An organization owns N environments
 * (dev/test/prod/sandbox/preview/…). Physical database connection info
 * is stored directly on this row (database_url, database_driver, etc.)
 * so a single JOIN-free lookup gives both logical and physical addressing.
 *
 * **This table lives in the Control Plane only.** Environment DBs contain
 * only business data rows — zero system tables.
 *
 * @namespace sys
 */
export const SysEnvironment = ObjectSchema.create({
  namespace: 'sys',
  name: 'environment',
  label: 'Environment',
  pluralLabel: 'Environments',
  icon: 'layers',
  isSystem: true,
  description: 'Control-plane registry of tenant environments (prod/test/dev/sandbox).',
  titleFormat: '{display_name}',
  compactLayout: ['display_name', 'slug', 'env_type', 'status', 'is_default'],

  fields: {
    id: Field.text({
      label: 'Environment ID',
      required: true,
      readonly: true,
      description: 'UUID of the environment (stable, never reused).',
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

    organization_id: Field.text({
      label: 'Organization ID',
      required: true,
      description: 'Foreign key to sys_organization.',
    }),

    slug: Field.text({
      label: 'Slug',
      required: true,
      maxLength: 63,
      description: 'Slug unique per organization (e.g. `prod`, `qa-2`). snake_case/kebab-case allowed.',
    }),

    display_name: Field.text({
      label: 'Display Name',
      required: true,
      maxLength: 255,
      description: 'Display name shown in Studio and APIs.',
    }),

    env_type: Field.select({
      label: 'Environment Type',
      required: true,
      description: 'Environment classification (prod/sandbox/dev/test/staging/preview/trial).',
      options: [
        { value: 'production', label: 'Production' },
        { value: 'sandbox', label: 'Sandbox' },
        { value: 'development', label: 'Development' },
        { value: 'test', label: 'Test' },
        { value: 'staging', label: 'Staging' },
        { value: 'preview', label: 'Preview' },
        { value: 'trial', label: 'Trial' },
      ],
    }),

    is_default: Field.boolean({
      label: 'Is Default',
      required: true,
      defaultValue: false,
      description: 'Whether this is the default environment for the organization. Exactly one per org.',
    }),

    region: Field.text({
      label: 'Region',
      required: false,
      maxLength: 100,
      description: 'Region where the physical database is deployed (e.g. us-east-1, eu-west-1).',
    }),

    plan: Field.select({
      label: 'Plan',
      required: true,
      defaultValue: 'free',
      description: 'Plan tier applied to this environment for quota and billing.',
      options: [
        { value: 'free', label: 'Free' },
        { value: 'starter', label: 'Starter' },
        { value: 'pro', label: 'Pro' },
        { value: 'enterprise', label: 'Enterprise' },
        { value: 'custom', label: 'Custom' },
      ],
    }),

    status: Field.select({
      label: 'Status',
      required: true,
      defaultValue: 'provisioning',
      description: 'Environment lifecycle status.',
      options: [
        { value: 'provisioning', label: 'Provisioning' },
        { value: 'active', label: 'Active' },
        { value: 'suspended', label: 'Suspended' },
        { value: 'archived', label: 'Archived' },
        { value: 'failed', label: 'Failed' },
        { value: 'migrating', label: 'Migrating' },
      ],
    }),

    created_by: Field.text({
      label: 'Created By',
      required: true,
      description: 'User ID that created the environment.',
    }),

    database_url: Field.url({
      label: 'Database URL',
      required: false,
      description: 'Connection URL for the environment database (e.g. libsql://env-uuid.turso.io). Set after provisioning.',
    }),

    database_driver: Field.text({
      label: 'Database Driver',
      required: false,
      maxLength: 50,
      description: 'Data-plane driver key (turso, libsql, sqlite, memory, postgres).',
    }),

    storage_limit_mb: Field.number({
      label: 'Storage Limit (MB)',
      required: false,
      defaultValue: 1024,
      description: 'Storage quota in megabytes.',
    }),

    provisioned_at: Field.datetime({
      label: 'Provisioned At',
      required: false,
      description: 'When the physical database was provisioned.',
    }),

    metadata: Field.textarea({
      label: 'Metadata',
      required: false,
      description: 'JSON-serialized free-form metadata (feature flags, tags, …).',
    }),
  },

  indexes: [
    { fields: ['organization_id', 'slug'], unique: true },
    { fields: ['organization_id'] },
    { fields: ['organization_id', 'is_default'] },
    { fields: ['status'] },
    { fields: ['env_type'] },
    { fields: ['database_driver'] },
  ],

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update'],
    trash: false,
    mru: true,
  },
});
