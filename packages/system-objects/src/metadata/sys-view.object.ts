// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_view Object Definition
 *
 * Represents view metadata as queryable data.
 * Registered without a namespace, so FQN = `sys_view` and table = `sys_view`.
 */
export const SysView = ObjectSchema.create({
  name: 'sys_view',
  label: 'View Definition',
  pluralLabel: 'View Definitions',
  description: 'Metadata for UI views (grid, kanban, calendar, etc.)',
  icon: 'layout-grid',
  isSystem: true,

  fields: {
    // Core Identity
    name: Field.text({
      label: 'View Name',
      required: true,
      maxLength: 255,
    }),

    env_id: Field.text({
      label: 'Environment ID',
      maxLength: 255,
      description: 'Project/environment scope — null = control-plane global',
    }),

    label: Field.text({
      label: 'Display Label',
      required: true,
      maxLength: 255,
    }),

    description: Field.textarea({
      label: 'Description',
    }),

    // Reference to Object
    object_name: Field.text({
      label: 'Object Name',
      required: true,
      maxLength: 255,
      description: 'The object this view displays',
    }),

    // View Type
    view_type: Field.select({
      label: 'View Type',
      required: true,
      options: [
        { value: 'grid', label: 'Grid' },
        { value: 'kanban', label: 'Kanban' },
        { value: 'calendar', label: 'Calendar' },
        { value: 'gantt', label: 'Gantt' },
        { value: 'form', label: 'Form' },
        { value: 'timeline', label: 'Timeline' },
      ],
    }),

    // Complex Configuration
    columns_json: Field.textarea({
      label: 'Columns (JSON)',
      description: 'Column definitions as JSON',
    }),

    filters_json: Field.textarea({
      label: 'Filters (JSON)',
      description: 'Filter definitions as JSON',
    }),

    sort_json: Field.textarea({
      label: 'Sort (JSON)',
      description: 'Sort configuration as JSON',
    }),

    config_json: Field.textarea({
      label: 'Configuration (JSON)',
      description: 'View-specific configuration as JSON',
    }),

    // Display Options
    page_size: Field.number({
      label: 'Page Size',
      defaultValue: 25,
      min: 1,
      max: 200,
    }),

    show_search: Field.boolean({
      label: 'Show Search',
      defaultValue: true,
    }),

    show_filters: Field.boolean({
      label: 'Show Filters',
      defaultValue: true,
    }),

    // Classification
    namespace: Field.text({
      label: 'Namespace',
      maxLength: 100,
    }),

    // Package Management
    package_id: Field.text({
      label: 'Package ID',
      maxLength: 255,
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
    created_by: Field.text({ label: 'Created By', maxLength: 255 }),
    created_at: Field.datetime({ label: 'Created At' }),
    updated_by: Field.text({ label: 'Updated By', maxLength: 255 }),
    updated_at: Field.datetime({ label: 'Updated At' }),
  },

  indexes: [
    { fields: ['name', 'env_id'], unique: true },
    { fields: ['env_id'] },
    { fields: ['object_name'] },
    { fields: ['view_type'] },
    { fields: ['namespace'] },
    { fields: ['package_id'] },
  ],

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    trash: true,
    mru: true,
  },
});
