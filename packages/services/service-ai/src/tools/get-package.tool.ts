// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * get_package — AI Tool Metadata
 *
 * Gets detailed information about a specific package.
 */
export const getPackageTool = defineTool({
  name: 'get_package',
  label: 'Get Package',
  description:
    'Gets detailed information about a specific installed package, including its manifest, ' +
    'metadata, and installation status.',
  category: 'utility',
  builtIn: true,
  parameters: {
    type: 'object',
    properties: {
      packageId: {
        type: 'string',
        description: 'Package identifier (reverse domain notation, e.g., com.acme.crm)',
      },
    },
    required: ['packageId'],
    additionalProperties: false,
  },
});
