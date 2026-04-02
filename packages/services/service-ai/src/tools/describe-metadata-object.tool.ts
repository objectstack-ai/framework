// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * describe_metadata_object — AI Tool Metadata
 *
 * Returns the full metadata schema of a data object including all
 * fields, types, relationships, and configuration. Uses a unique name
 * (`describe_metadata_object`) to avoid collision with the data-tools
 * `describe_object` tool.
 */
export const describeMetadataObjectTool = defineTool({
  name: 'describe_metadata_object',
  label: 'Describe Metadata Object',
  description:
    'Returns the full metadata schema details of a data object, including all fields, types, relationships, and configuration. ' +
    'Use this when the user wants to inspect or understand the metadata structure of a specific table or entity.',
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
