// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * modify_field — AI Tool Metadata
 *
 * Modifies an existing field definition (label, type, required, default value, etc.)
 * on a data object. Does not support renaming the field.
 */
export const modifyFieldTool = defineTool({
  name: 'modify_field',
  label: 'Modify Field',
  description:
    'Modifies an existing field definition (label, type, required, default value, etc.) on a data object. ' +
    'Use this when the user wants to change or reconfigure an existing column or attribute (not rename it).',
  category: 'data',
  builtIn: true,
  parameters: {
    type: 'object',
    properties: {
      packageId: {
        type: 'string',
        description: 'Package ID that owns the target object (e.g., com.acme.crm). If not provided, uses the active package from conversation context.',
      },
      objectName: {
        type: 'string',
        description: 'Target object machine name (snake_case)',
      },
      fieldName: {
        type: 'string',
        description: 'Existing field machine name to modify (snake_case)',
      },
      changes: {
        type: 'object',
        description: 'Field properties to update (partial patch)',
        properties: {
          label: { type: 'string', description: 'New display label' },
          type: { type: 'string', description: 'New field type' },
          required: { type: 'boolean', description: 'Update required constraint' },
          defaultValue: { description: 'New default value' },
        },
      },
    },
    required: ['objectName', 'fieldName', 'changes'],
    additionalProperties: false,
  },
});
