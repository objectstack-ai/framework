// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * create_package — AI Tool Metadata
 *
 * Creates a new package for organizing metadata.
 * All metadata (objects, views, flows, etc.) should belong to a package.
 */
export const createPackageTool = defineTool({
  name: 'create_package',
  label: 'Create Package',
  description:
    'Creates a new package (metadata container) with the specified manifest. ' +
    'All metadata in ObjectStack should belong to a package. Use this when starting new development ' +
    'or when the user wants to organize their metadata into a new module.',
  category: 'utility',
  builtIn: true,
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Package identifier in reverse domain notation (e.g., com.acme.crm, org.mycompany.sales)',
      },
      name: {
        type: 'string',
        description: 'Human-readable package name (e.g., "CRM Application", "Sales Module")',
      },
      version: {
        type: 'string',
        description: 'Semantic version (e.g., "1.0.0")',
        default: '1.0.0',
      },
      description: {
        type: 'string',
        description: 'Brief description of what this package provides',
      },
      namespace: {
        type: 'string',
        description: 'Namespace prefix for metadata (snake_case, e.g., crm, sales). If not provided, derived from package ID.',
      },
      type: {
        type: 'string',
        description: 'Package type',
        enum: ['application', 'plugin', 'library', 'template'],
        default: 'application',
      },
    },
    required: ['id', 'name'],
    additionalProperties: false,
  },
});
