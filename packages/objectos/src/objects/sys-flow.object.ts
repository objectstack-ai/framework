// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_flow Object Definition
 *
 * Represents flow metadata as queryable data.
 */
export const SysFlow = ObjectSchema.create({
  name: 'sys_flow',
  namespace: 'sys',
  label: 'Flow',
  pluralLabel: 'Flows',
  description: 'Visual logic flow definitions',
  icon: 'workflow',

  fields: {
    // Core Identity
    name: Field.text({
      label: 'Flow Name',
      required: true,
      maxLength: 255,
    }),

    label: Field.text({
      label: 'Display Label',
      required: true,
      maxLength: 255,
    }),

    description: Field.textarea({
      label: 'Description',
    }),

    // Flow Type
    flow_type: Field.select({
      label: 'Flow Type',
      required: true,
      options: [
        { value: 'autolaunched', label: 'Autolaunched' },
        { value: 'screen', label: 'Screen Flow' },
        { value: 'schedule', label: 'Scheduled' },
        { value: 'trigger', label: 'Trigger-Based' },
      ],
    }),

    // Flow Definition
    nodes_json: Field.textarea({
      label: 'Nodes (JSON)',
      description: 'Flow nodes as JSON',
    }),

    edges_json: Field.textarea({
      label: 'Edges (JSON)',
      description: 'Flow edges as JSON',
    }),

    variables_json: Field.textarea({
      label: 'Variables (JSON)',
      description: 'Flow variables as JSON',
    }),

    // Trigger Configuration
    trigger_type: Field.select({
      label: 'Trigger Type',
      options: [
        { value: 'record_created', label: 'Record Created' },
        { value: 'record_updated', label: 'Record Updated' },
        { value: 'record_deleted', label: 'Record Deleted' },
        { value: 'schedule', label: 'Schedule' },
        { value: 'platform_event', label: 'Platform Event' },
      ],
    }),

    trigger_object: Field.text({
      label: 'Trigger Object',
      maxLength: 255,
    }),

    // Status
    active: Field.boolean({
      label: 'Active',
      defaultValue: false,
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
    { fields: ['name'], unique: true },
    { fields: ['flow_type'] },
    { fields: ['active'] },
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
