// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * create_object — AI Tool Metadata
 *
 * Creates a new data object (table) with schema validation.
 * Validates snake_case naming for object and initial fields,
 * checks for duplicates, and registers the object definition.
 */
export const createObjectTool = defineTool({
  name: 'create_object',
  label: 'Create Object',
  description:
    'Creates a new data object (table) with the specified name, label, and optional field definitions. ' +
    'Use this when the user wants to create a new entity, table, or data model.',
  category: 'data',
  builtIn: true,
  // NOTE: requiresConfirmation is intentionally false (default) because the
  // server-side tool-call loop in AIService.chatWithTools/streamChatWithTools
  // executes tool calls immediately without checking this flag.  The flag
  // should only be set once server-side approval gating is implemented to
  // avoid giving users a false sense of safety.
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Machine name for the object (snake_case, e.g. project_task)',
      },
      label: {
        type: 'string',
        description: 'Human-readable display name (e.g. Project Task)',
      },
      packageId: {
        type: 'string',
        description: 'Package ID that will own this object (e.g., com.acme.crm). If not provided, uses the active package from conversation context.',
      },
      fields: {
        type: 'array',
        description: 'Initial fields to create with the object',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Field machine name (snake_case)' },
            label: { type: 'string', description: 'Field display name' },
            type: {
              type: 'string',
              description: 'Field data type',
              enum: ['text', 'textarea', 'number', 'boolean', 'date', 'datetime', 'select', 'lookup', 'formula', 'autonumber'],
            },
            required: { type: 'boolean', description: 'Whether the field is required' },
          },
          required: ['name', 'type'],
        },
      },
      enableFeatures: {
        type: 'object',
        description: 'Object capability flags',
        properties: {
          trackHistory: { type: 'boolean' },
          apiEnabled: { type: 'boolean' },
        },
      },
    },
    required: ['name', 'label'],
    additionalProperties: false,
  },
});
