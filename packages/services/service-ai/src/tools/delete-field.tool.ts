// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * delete_field — AI Tool Metadata
 *
 * Removes a field (column) from an existing data object.
 * This is a destructive operation.
 */
export const deleteFieldTool = defineTool({
  name: 'delete_field',
  label: 'Delete Field',
  description:
    'Removes a field (column) from an existing data object. This is a destructive operation. ' +
    'Use this when the user explicitly wants to remove an attribute or column from a table.',
  category: 'data',
  builtIn: true,
  // NOTE: requiresConfirmation is intentionally false (default) because the
  // server-side tool-call loop in AIService.chatWithTools/streamChatWithTools
  // executes tool calls immediately without checking this flag.  The flag
  // should only be set once server-side approval gating is implemented.
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
        description: 'Field machine name to delete (snake_case)',
      },
    },
    required: ['objectName', 'fieldName'],
    additionalProperties: false,
  },
});
