// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * get_active_package — AI Tool Metadata
 *
 * Gets the currently active package in the conversation context.
 */
export const getActivePackageTool = defineTool({
  name: 'get_active_package',
  label: 'Get Active Package',
  description:
    'Gets the currently active package in this conversation. The active package determines ' +
    'where new metadata will be created. Returns null if no package is set.',
  category: 'utility',
  builtIn: true,
  parameters: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
});
