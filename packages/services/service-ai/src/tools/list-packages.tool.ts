// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * list_packages — AI Tool Metadata
 *
 * Lists all installed packages in the ObjectStack instance.
 * Useful for understanding what packages are available before creating metadata.
 */
export const listPackagesTool = defineTool({
  name: 'list_packages',
  label: 'List Packages',
  description:
    'Lists all installed packages in the system. Use this to see what packages are available ' +
    'before creating or modifying metadata. Packages are the containers that hold metadata.',
  category: 'utility',
  builtIn: true,
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by package status',
        enum: ['installed', 'disabled', 'installing', 'upgrading', 'uninstalling', 'error'],
      },
      enabled: {
        type: 'boolean',
        description: 'Filter by enabled state (true = only enabled, false = only disabled)',
      },
    },
    additionalProperties: false,
  },
});
