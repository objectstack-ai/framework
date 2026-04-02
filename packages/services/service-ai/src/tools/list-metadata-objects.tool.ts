// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * list_metadata_objects — AI Tool Metadata
 *
 * Lists all registered metadata objects (tables) with optional filtering.
 * Uses a unique name (`list_metadata_objects`) to avoid collision with
 * the data-tools `list_objects` tool.
 */
export const listMetadataObjectsTool = defineTool({
  name: 'list_metadata_objects',
  label: 'List Metadata Objects',
  description:
    'Lists all registered metadata objects (tables) in the current environment. ' +
    'Use this when the user wants to see what tables, entities, or data models are defined in metadata.',
  category: 'data',
  builtIn: true,
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description: 'Optional name or label substring to filter objects',
      },
      includeFields: {
        type: 'boolean',
        description: 'Whether to include field summaries for each object (default: false)',
      },
    },
    additionalProperties: false,
  },
});
