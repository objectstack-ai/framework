// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * describe_object — AI Tool Metadata
 *
 * Returns the full schema of a data object including all fields, types,
 * relationships, and configuration. This is the single, unified tool for
 * describing objects — used by both data_chat and metadata_assistant agents.
 */
export const describeObjectTool = defineTool({
  name: 'describe_object',
  label: 'Describe Object',
  description:
    'Returns the full schema details of a data object, including all fields, types, relationships, and configuration. ' +
    'Use this to understand the structure of a table before querying or modifying it.',
  category: 'data',
  builtIn: true,
  parameters: {
    type: 'object',
    properties: {
      objectName: {
        type: 'string',
        description: 'Object machine name to describe (snake_case)',
      },
    },
    required: ['objectName'],
    additionalProperties: false,
  },
});
