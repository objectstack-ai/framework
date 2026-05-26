// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from '../ui/view.zod';

/**
 * Form Layout for Object Metadata Type
 */
export const objectForm = defineForm({
  schemaId: 'object',
  type: 'tabbed',
  sections: [
    {
      label: 'Basics',
      description: 'Identity, labels, and taxonomy.',
      fields: [
        { field: 'name', type: 'text', required: true, helpText: 'snake_case unique identifier (immutable)' },
        { field: 'label', type: 'text', helpText: 'Singular display name (e.g. "Account")' },
        { field: 'pluralLabel', type: 'text', helpText: 'Plural display name (e.g. "Accounts")' },
        { field: 'icon', type: 'text', helpText: 'Lucide icon name (e.g. "building", "users")' },
        { field: 'description', type: 'textarea', helpText: 'Developer documentation' },
        { field: 'tags', widget: 'string-tags', helpText: 'Categorization tags (e.g. "sales", "system")' },
        { field: 'active', type: 'boolean', helpText: 'Is the object active and usable' },
        { field: 'isSystem', type: 'boolean', helpText: 'System object (protected from deletion)' },
        { field: 'abstract', type: 'boolean', helpText: 'Abstract base (cannot be instantiated)' },
      ],
    },
    {
      label: 'Fields',
      description: 'Define the data model.',
      fields: [
        { 
          field: 'fields', 
          widget: 'master-detail', 
          required: true,
          helpText: 'Field definitions — each row is a column in the database table',
        },
      ],
    },
    {
      label: 'Capabilities',
      description: 'System features and API exposure.',
      fields: [
        { field: 'capabilities', widget: 'object-fields', helpText: 'Enable/disable system features' },
      ],
    },
    {
      label: 'Advanced',
      description: 'State machines, actions, and storage.',
      collapsible: true,
      collapsed: true,
      fields: [
        { field: 'datasource', type: 'text', helpText: 'Target datasource ID (default: "default")' },
      ],
    },
  ],
});
