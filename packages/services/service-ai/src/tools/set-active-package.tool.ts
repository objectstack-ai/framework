// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * set_active_package — AI Tool Metadata
 *
 * Sets the active package for the current conversation.
 * All metadata operations will use this package context.
 */
export const setActivePackageTool = defineTool({
  name: 'set_active_package',
  label: 'Set Active Package',
  description:
    'Sets the active package for this conversation. All subsequent metadata creation operations ' +
    '(objects, views, flows, etc.) will be associated with this package unless explicitly overridden.',
  category: 'utility',
  builtIn: true,
  parameters: {
    type: 'object',
    properties: {
      packageId: {
        type: 'string',
        description: 'Package identifier to set as active (e.g., com.acme.crm)',
      },
    },
    required: ['packageId'],
    additionalProperties: false,
  },
});
