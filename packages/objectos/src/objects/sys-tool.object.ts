// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * sys_tool Object Definition
 *
 * Represents AI tool metadata as queryable data.
 * Registered without a namespace, so FQN = `sys_tool` and table = `sys_tool`.
 */
export const SysTool = ObjectSchema.create({
  name: 'sys_tool',
  label: 'AI Tool',
  pluralLabel: 'AI Tools',
  description: 'AI tool definitions',
  icon: 'wrench',

  fields: {
    // Core Identity
    name: Field.text({
      label: 'Tool Name',
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
      required: true,
    }),

    // Parameters
    parameters_json: Field.textarea({
      label: 'Parameters (JSON)',
      description: 'Tool parameter schema as JSON',
    }),

    // Implementation
    handler_code: Field.textarea({
      label: 'Handler Code',
      description: 'Tool implementation code',
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
