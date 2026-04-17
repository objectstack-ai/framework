// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * add_field — AI Tool Metadata
 *
 * Adds a new field (column) to an existing data object.
 * Validates snake_case for objectName, field name, reference,
 * and select option values before merging into the definition.
 */
export const addFieldTool = defineTool({
  name: 'add_field',
  label: 'Add Field',
  description:
    'Adds a new field (column) to an existing data object. ' +
    'Use this when the user wants to add a property, column, or attribute to a table.',
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
      name: {
        type: 'string',
        description: 'Field machine name (snake_case, e.g. due_date)',
      },
      label: {
        type: 'string',
        description: 'Human-readable field label (e.g. Due Date)',
      },
      type: {
        type: 'string',
        description: 'Field data type',
        enum: ['text', 'textarea', 'number', 'boolean', 'date', 'datetime', 'select', 'lookup', 'formula', 'autonumber'],
      },
      required: {
        type: 'boolean',
        description: 'Whether the field is required',
      },
      defaultValue: {
        description: 'Default value for the field',
      },
      options: {
        type: 'array',
        description: 'Options for select/picklist fields',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            value: {
              type: 'string',
              description: 'Option machine identifier (lowercase snake_case, e.g. high_priority)',
              pattern: '^[a-z_][a-z0-9_]*$',
            },
          },
        },
      },
      reference: {
        type: 'string',
        description: 'Referenced object name for lookup fields (snake_case, e.g. account)',
      },
    },
    required: ['objectName', 'name', 'type'],
    additionalProperties: false,
  },
});
