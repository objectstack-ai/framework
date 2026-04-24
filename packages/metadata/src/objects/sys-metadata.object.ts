// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_metadata — System Metadata Object
 *
 * Canonical ObjectStack object definition for the metadata persistence table.
 * Stores all platform-scope and user-scope metadata records (Objects, Views,
 * Flows, etc.) using the MetadataRecordSchema envelope.
 *
 * This is a system object (isSystem: true) — protected from deletion and
 * automatically provisioned by the DatabaseLoader on first use.
 *
 * @see MetadataRecordSchema in metadata-persistence.zod.ts
 */
export const SysMetadataObject = ObjectSchema.create({
  name: 'sys_metadata',
  label: 'System Metadata',
  pluralLabel: 'System Metadata',
  icon: 'settings',
  isSystem: true,
  description: 'Stores platform and user-scope metadata records (objects, views, flows, etc.)',

  fields: {
    /** Primary Key (UUID) */
    id: Field.text({
      label: 'ID',
      required: true,
      readonly: true,
    }),

    /** Machine name — unique identifier used in code references */
    name: Field.text({
      label: 'Name',
      required: true,
      searchable: true,
      maxLength: 255,
    }),

    /** Metadata type (e.g. "object", "view", "flow") */
    type: Field.text({
      label: 'Metadata Type',
      required: true,
      searchable: true,
      maxLength: 100,
    }),

    /** Namespace / module grouping (e.g. "crm", "core") */
    namespace: Field.text({
      label: 'Namespace',
      required: false,
      defaultValue: 'default',
      maxLength: 100,
    }),

    /** Package that owns/delivered this metadata (legacy string identifier, kept for compat) */
    package_id: Field.text({
      label: 'Package ID',
      required: false,
      maxLength: 255,
      description: 'Legacy package manifest ID string. Use package_version_id for new records.',
    }),

    /**
     * FK → sys_package_version (UUID). Set for metadata that belongs to a specific
     * package release snapshot. NULL = platform-built-in or environment override.
     */
    package_version_id: Field.text({
      label: 'Package Version ID',
      required: false,
      maxLength: 255,
      description:
        'Foreign key to sys_package_version (UUID). Null = platform-built-in or env-level override.',
    }),

    /** Who manages this record: package, platform, or user */
    managed_by: Field.select(['package', 'platform', 'user'], {
      label: 'Managed By',
      required: false,
    }),

    /** Scope: system (code), platform (admin DB), user (personal DB) */
    scope: Field.select(['system', 'platform', 'user'], {
      label: 'Scope',
      required: true,
      defaultValue: 'platform',
    }),

    /** JSON payload — the actual metadata configuration */
    metadata: Field.textarea({
      label: 'Metadata',
      required: true,
      description: 'JSON-serialized metadata payload',
    }),

    /** Parent metadata name for extension/override */
    extends: Field.text({
      label: 'Extends',
      required: false,
      maxLength: 255,
    }),

    /** Merge strategy when extending parent metadata */
    strategy: Field.select(['merge', 'replace'], {
      label: 'Strategy',
      required: false,
      defaultValue: 'merge',
    }),

    /** Owner user ID (for user-scope items) */
    owner: Field.text({
      label: 'Owner',
      required: false,
      maxLength: 255,
    }),

    /** Lifecycle state */
    state: Field.select(['draft', 'active', 'archived', 'deprecated'], {
      label: 'State',
      required: false,
      defaultValue: 'active',
    }),

    /** Organization ID for multi-tenant isolation */
    organization_id: Field.text({
      label: 'Organization ID',
      required: false,
      maxLength: 255,
      description: 'Organization identifier for multi-tenant isolation.',
    }),

    /** Environment ID — null = platform-global, set = env-scoped */
    env_id: Field.text({
      label: 'Environment ID',
      required: false,
      maxLength: 255,
      description: 'Scopes this metadata to a specific environment. Null = platform-global.',
    }),

    /** Version number for optimistic concurrency */
    version: Field.number({
      label: 'Version',
      required: false,
      defaultValue: 1,
    }),

    /** Content checksum for change detection */
    checksum: Field.text({
      label: 'Checksum',
      required: false,
      maxLength: 64,
    }),

    /** Origin of this metadata record */
    source: Field.select(['filesystem', 'database', 'api', 'migration'], {
      label: 'Source',
      required: false,
    }),

    /** Classification tags (JSON array) */
    tags: Field.textarea({
      label: 'Tags',
      required: false,
      description: 'JSON-serialized array of classification tags',
    }),

    /** Audit fields */
    created_by: Field.text({
      label: 'Created By',
      required: false,
      readonly: true,
      maxLength: 255,
    }),

    created_at: Field.datetime({
      label: 'Created At',
      required: false,
      readonly: true,
    }),

    updated_by: Field.text({
      label: 'Updated By',
      required: false,
      maxLength: 255,
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      required: false,
    }),
  },

  indexes: [
    { fields: ['type', 'name', 'env_id'], unique: true },
    { fields: ['type', 'scope'] },
    { fields: ['organization_id'] },
    { fields: ['env_id'] },
    { fields: ['package_version_id'] },
    { fields: ['state'] },
    { fields: ['namespace'] },
  ],

  enable: {
    trackHistory: true,
    searchable: false,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
    trash: false,
  },
});
