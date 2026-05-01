// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_object Object Definition
 *
 * Represents object metadata as queryable data.
 * Allows Studio to browse/filter/search object definitions using the Object Protocol.
 * Registered without a namespace, so FQN = `sys_object` and table = `sys_object`.
 */
export const SysObject = ObjectSchema.create({
  name: 'sys_object',
  label: 'Object Definition',
  pluralLabel: 'Object Definitions',
  description: 'Metadata for business objects',
  icon: 'database',
  isSystem: true,

  fields: {
    // Core Identity
    name: Field.text({
      label: 'Object Name',
      required: true,
      maxLength: 255,
      description: 'Machine name (snake_case)',
    }),

    project_id: Field.text({
      label: 'Environment ID',
      maxLength: 255,
      description: 'Project/environment scope — null = control-plane global',
    }),

    label: Field.text({
      label: 'Display Label',
      required: true,
      maxLength: 255,
    }),

    plural_label: Field.text({
      label: 'Plural Label',
      maxLength: 255,
    }),

    description: Field.textarea({
      label: 'Description',
    }),

    icon: Field.text({
      label: 'Icon',
      maxLength: 100,
    }),

    // Classification
    namespace: Field.text({
      label: 'Namespace',
      maxLength: 100,
      description: 'Logical domain namespace',
    }),

    tags: Field.text({
      label: 'Tags',
      description: 'Comma-separated categorization tags',
    }),

    active: Field.boolean({
      label: 'Active',
      defaultValue: true,
    }),

    is_system: Field.boolean({
      label: 'System Object',
      defaultValue: false,
      description: 'Protected from deletion',
    }),

    abstract: Field.boolean({
      label: 'Abstract',
      defaultValue: false,
      description: 'Cannot be instantiated',
    }),

    // Storage
    datasource: Field.text({
      label: 'Datasource',
      maxLength: 100,
      defaultValue: 'default',
    }),

    table_name: Field.text({
      label: 'Table Name',
      maxLength: 255,
      description: 'Physical table/collection name',
    }),

    // Complex Data (stored as JSON)
    fields_json: Field.textarea({
      label: 'Fields (JSON)',
      description: 'Field definitions as JSON',
    }),

    indexes_json: Field.textarea({
      label: 'Indexes (JSON)',
      description: 'Index definitions as JSON',
    }),

    validations_json: Field.textarea({
      label: 'Validations (JSON)',
      description: 'Validation rules as JSON',
    }),

    state_machines_json: Field.textarea({
      label: 'State Machines (JSON)',
      description: 'State machine definitions as JSON',
    }),

    capabilities_json: Field.textarea({
      label: 'Capabilities (JSON)',
      description: 'Enabled system features as JSON',
    }),

    // Denormalized Fields
    field_count: Field.number({
      label: 'Field Count',
      description: 'Number of fields defined',
    }),

    // Display
    display_name_field: Field.text({
      label: 'Display Name Field',
      maxLength: 100,
      description: 'Field to use as record display name',
    }),

    title_format: Field.text({
      label: 'Title Format',
      maxLength: 255,
      description: 'Title expression template',
    }),

    compact_layout: Field.text({
      label: 'Compact Layout',
      description: 'Comma-separated field names for cards',
    }),

    // Capabilities
    track_history: Field.boolean({
      label: 'Track History',
      defaultValue: false,
    }),

    searchable: Field.boolean({
      label: 'Searchable',
      defaultValue: true,
    }),

    api_enabled: Field.boolean({
      label: 'API Enabled',
      defaultValue: true,
    }),

    files: Field.boolean({
      label: 'Files',
      defaultValue: false,
    }),

    feeds: Field.boolean({
      label: 'Feeds',
      defaultValue: false,
    }),

    activities: Field.boolean({
      label: 'Activities',
      defaultValue: false,
    }),

    trash: Field.boolean({
      label: 'Trash',
      defaultValue: true,
    }),

    mru: Field.boolean({
      label: 'MRU',
      defaultValue: true,
    }),

    clone: Field.boolean({
      label: 'Clone',
      defaultValue: true,
    }),

    // Package Management
    package_id: Field.lookup('sys_package', {
      label: 'Package',
    }),

    managed_by: Field.select({
      label: 'Managed By',
      options: [
        { value: 'package', label: 'Package' },
        { value: 'platform', label: 'Platform' },
        { value: 'user', label: 'User' },
      ],
    }),

    // Audit
    created_by: Field.lookup('sys_user', { label: 'Created By' }),
    created_at: Field.datetime({ label: 'Created At' }),
    updated_by: Field.lookup('sys_user', { label: 'Updated By' }),
    updated_at: Field.datetime({ label: 'Updated At' }),
  },

  indexes: [
    { fields: ['name', 'project_id'], unique: true },
    { fields: ['project_id'] },
    { fields: ['namespace'] },
    { fields: ['package_id'] },
    { fields: ['active'] },
    { fields: ['is_system'] },
  ],

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    trash: true,
    mru: true,
  },
});
