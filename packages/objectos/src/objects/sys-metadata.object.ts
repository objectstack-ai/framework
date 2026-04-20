// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_metadata Object Definition
 *
 * Generic metadata envelope for ALL metadata types.
 * This is the source of truth for package management, version control, and deployment.
 */
export const SysMetadata = ObjectSchema.create({
  name: 'sys_metadata',
  namespace: 'sys',
  label: 'Metadata Record',
  pluralLabel: 'Metadata Records',
  description: 'Generic metadata envelope for package management and version control',
  icon: 'database',

  fields: {
    // Identity
    name: Field.text({
      label: 'Machine Name',
      required: true,
      maxLength: 255,
      description: 'Machine name (snake_case)',
    }),

    type: Field.select({
      label: 'Metadata Type',
      required: true,
      options: [
        { value: 'object', label: 'Object' },
        { value: 'field', label: 'Field' },
        { value: 'view', label: 'View' },
        { value: 'dashboard', label: 'Dashboard' },
        { value: 'app', label: 'Application' },
        { value: 'action', label: 'Action' },
        { value: 'flow', label: 'Flow' },
        { value: 'workflow', label: 'Workflow' },
        { value: 'agent', label: 'AI Agent' },
        { value: 'tool', label: 'AI Tool' },
        { value: 'skill', label: 'AI Skill' },
        { value: 'permission', label: 'Permission Set' },
        { value: 'profile', label: 'Profile' },
        { value: 'role', label: 'Role' },
      ],
    }),

    namespace: Field.text({
      label: 'Namespace',
      maxLength: 100,
      defaultValue: 'default',
    }),

    // Package Management
    package_id: Field.text({
      label: 'Package ID',
      maxLength: 255,
      description: 'Package that owns/delivered this metadata',
    }),

    managed_by: Field.select({
      label: 'Managed By',
      options: [
        { value: 'package', label: 'Package' },
        { value: 'platform', label: 'Platform' },
        { value: 'user', label: 'User' },
      ],
      description: 'Who manages this metadata lifecycle',
    }),

    scope: Field.select({
      label: 'Scope',
      required: true,
      defaultValue: 'platform',
      options: [
        { value: 'system', label: 'System' },
        { value: 'platform', label: 'Platform' },
        { value: 'user', label: 'User' },
      ],
    }),

    // Payload
    metadata_json: Field.textarea({
      label: 'Metadata (JSON)',
      required: true,
      description: 'The actual metadata definition as JSON',
    }),

    // Versioning
    version: Field.number({
      label: 'Version',
      required: true,
      defaultValue: 1,
      description: 'Version number for optimistic concurrency',
    }),

    checksum: Field.text({
      label: 'Checksum',
      maxLength: 255,
      description: 'Content checksum for change detection',
    }),

    // Extension
    extends: Field.text({
      label: 'Extends',
      maxLength: 255,
      description: 'Name of the parent metadata to extend/override',
    }),

    strategy: Field.select({
      label: 'Merge Strategy',
      defaultValue: 'merge',
      options: [
        { value: 'merge', label: 'Merge' },
        { value: 'replace', label: 'Replace' },
      ],
    }),

    // State
    state: Field.select({
      label: 'State',
      required: true,
      defaultValue: 'active',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'active', label: 'Active' },
        { value: 'archived', label: 'Archived' },
        { value: 'deprecated', label: 'Deprecated' },
      ],
    }),

    // Multi-tenant
    organization_id: Field.text({
      label: 'Organization ID',
      maxLength: 255,
      description: 'Organization identifier for multi-tenant isolation',
    }),

    environment_id: Field.text({
      label: 'Environment ID',
      maxLength: 255,
      description: 'Environment ID — null = platform-global, set = env-scoped',
    }),

    // Source
    source: Field.select({
      label: 'Source',
      options: [
        { value: 'filesystem', label: 'Filesystem' },
        { value: 'database', label: 'Database' },
        { value: 'api', label: 'API' },
        { value: 'migration', label: 'Migration' },
      ],
      description: 'Origin of this metadata record',
    }),

    // Publishing
    published_definition: Field.textarea({
      label: 'Published Definition',
      description: 'Snapshot of the last published definition',
    }),

    published_at: Field.datetime({
      label: 'Published At',
      description: 'When this metadata was last published',
    }),

    published_by: Field.text({
      label: 'Published By',
      maxLength: 255,
      description: 'Who published this version',
    }),

    // Audit
    created_by: Field.text({ label: 'Created By', maxLength: 255 }),
    created_at: Field.datetime({ label: 'Created At' }),
    updated_by: Field.text({ label: 'Updated By', maxLength: 255 }),
    updated_at: Field.datetime({ label: 'Updated At' }),
  },

  indexes: [
    { fields: ['type', 'name'], unique: true },
    { fields: ['package_id'] },
    { fields: ['namespace'] },
    { fields: ['state'] },
    { fields: ['organization_id'] },
    { fields: ['environment_id'] },
  ],

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    trash: true,
    mru: true,
  },
});
