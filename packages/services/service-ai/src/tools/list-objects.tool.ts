// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * list_objects — AI Tool Metadata
 *
 * Lists all registered data objects (tables) with optional filtering
 * and field summaries. This is the single, unified tool for listing
 * objects — used by both data_chat and metadata_assistant agents.
 */
export const listObjectsTool = defineTool({
  name: 'list_objects',
  label: 'List Objects',
  description:
    'Lists all registered data objects (tables) in the current environment. ' +
    'Use this when the user wants to see what tables, entities, or data models are available.',
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
