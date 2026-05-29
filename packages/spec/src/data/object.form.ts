// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from '../ui/view.zod';

/**
 * Form Layout for Object Metadata Type
 */
export const objectForm = defineForm({
  schemaId: 'object',
  type: 'simple',
  sections: [
    {
      name: 'basics',
      label: 'Basics',
      description: 'Identity, labels, and taxonomy.',
      columns: 2,
      fields: [
        { field: 'name', type: 'text', required: true, immutable: true, colSpan: 1, helpText: 'snake_case unique identifier (immutable after creation)' },
        { field: 'label', type: 'text', colSpan: 1, helpText: 'Singular display name (e.g. "Account")' },
        { field: 'pluralLabel', type: 'text', colSpan: 1, helpText: 'Plural display name (e.g. "Accounts")' },
        { field: 'icon', type: 'text', colSpan: 1, helpText: 'Lucide icon name (e.g. "building", "users")' },
        { field: 'description', type: 'textarea', colSpan: 2, helpText: 'Developer documentation' },
        { field: 'tags', type: 'tags', colSpan: 2, helpText: 'Categorization tags (e.g. "sales", "system")' },
        { field: 'active', type: 'boolean', colSpan: 1, helpText: 'Is the object active and usable' },
        { field: 'isSystem', type: 'boolean', colSpan: 1, helpText: 'System object (protected from deletion)' },
        { field: 'abstract', type: 'boolean', colSpan: 1, helpText: 'Abstract base (cannot be instantiated)' },
      ],
    },
    {
      name: 'fields',
      label: 'Fields',
      description: 'Define the data model — each entry becomes a column in the database table.',
      fields: [
        {
          field: 'fields',
          type: 'record',
          widget: 'airtable',
          required: true,
          helpText: 'Add the columns this object will store',
          keyField: {
            field: 'name',
            label: 'Name',
            placeholder: 'snake_case_identifier',
            helpText: 'snake_case machine name (used as column name and API key)',
            regex: '^[a-z_][a-z0-9_]*$',
            immutable: true,
          },
          fields: [
            { field: 'label', type: 'text', helpText: 'Display label' },
            { field: 'type', type: 'select', required: true, helpText: 'Field type' },
            { field: 'required', type: 'boolean' },
            { field: 'reference', type: 'text', helpText: 'Target object (for lookup/master_detail)' },
          ],
        },
      ],
    },
    {
      name: 'capabilities',
      label: 'Capabilities',
      description: 'System features and API exposure.',
      collapsible: true,
      collapsed: true,
      fields: [
        {
          field: 'capabilities',
          type: 'composite',
          helpText: 'Enable/disable system features',
          fields: [
            { field: 'trackHistory', type: 'boolean' },
            { field: 'searchable', type: 'boolean' },
            { field: 'apiEnabled', type: 'boolean' },
            { field: 'files', type: 'boolean' },
            { field: 'feeds', type: 'boolean' },
            { field: 'activities', type: 'boolean' },
            { field: 'trash', type: 'boolean' },
            { field: 'mru', type: 'boolean' },
            { field: 'clone', type: 'boolean' },
          ],
        },
      ],
    },
    {
      name: 'advanced',
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
