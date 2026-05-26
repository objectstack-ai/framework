// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from './view.zod';

export const appForm = defineForm({
  schemaId: 'app',
  type: 'tabbed',
  sections: [
    {
      label: 'Basics',
      fields: [
        { field: 'name', required: true, helpText: 'snake_case, unique' },
        { field: 'label', required: true },
        { field: 'description' },
        { field: 'version' },
        { field: 'icon', helpText: 'Lucide icon name (e.g. "users", "briefcase")' },
        { field: 'active' },
        { field: 'isDefault', helpText: 'Make this the default app for new users' },
      ],
    },
    {
      label: 'Navigation',
      description: 'Sidebar items and area grouping.',
      fields: [
        { field: 'navigation', widget: 'master-detail' },
        { field: 'areas', widget: 'master-detail' },
        { field: 'homePageId' },
        { field: 'mobileNavigation', widget: 'json' },
      ],
    },
    {
      label: 'Content',
      description: 'Objects and APIs this app uses.',
      fields: [
        { field: 'objects', widget: 'master-detail' },
        { field: 'apis', widget: 'master-detail' },
        { field: 'defaultAgent', helpText: 'AI agent for the ambient assistant button' },
      ],
    },
    {
      label: 'Branding',
      fields: [{ field: 'branding', widget: 'json' }],
    },
    {
      label: 'Access & sharing',
      fields: [
        { field: 'requiredPermissions', widget: 'json' },
        { field: 'sharing', widget: 'json' },
        { field: 'embed', widget: 'json' },
        { field: 'aria', widget: 'json' },
      ],
    },
  ],
});
