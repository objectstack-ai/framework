// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from './view.zod';

export const appForm = defineForm({
  schemaId: 'app',
  type: 'tabbed',
  sections: [
    {
      label: 'Basics',
      fields: [
        { field: 'name', type: 'text', required: true, helpText: 'snake_case, unique' },
        { field: 'label', type: 'text', required: true },
        { field: 'description', type: 'textarea' },
        { field: 'version', type: 'text' },
        { field: 'icon', type: 'text', helpText: 'Lucide icon name (e.g. "users", "briefcase")' },
        { field: 'active', type: 'boolean' },
        { field: 'isDefault', type: 'boolean', helpText: 'Make this the default app for new users' },
      ],
    },
    {
      label: 'Navigation',
      description: 'Sidebar items and area grouping.',
      fields: [
        { field: 'navigation', widget: 'json', helpText: 'Nav tree — JSON array of nav items' },
        { field: 'areas', widget: 'master-detail', helpText: 'Group items into collapsible areas' },
        { field: 'homePageId', type: 'text', helpText: 'Landing page when app opens' },
        { field: 'mobileNavigation', widget: 'json', helpText: 'Bottom tab bar config for mobile' },
      ],
    },
    {
      label: 'Content',
      description: 'Objects and APIs this app uses.',
      fields: [
        { field: 'objects', widget: 'object-selector', type: 'array', multiple: true, helpText: 'Object names this app exposes' },
        { field: 'apis', widget: 'json', helpText: 'API endpoint definitions' },
        { field: 'defaultAgent', type: 'text', helpText: 'AI agent for the ambient assistant button' },
      ],
    },
    {
      label: 'Branding',
      fields: [{ field: 'branding', widget: 'json', helpText: 'Primary/secondary colors, logo, theme' }],
    },
    {
      label: 'Access & sharing',
      fields: [
        { field: 'requiredPermissions', widget: 'string-tags', helpText: 'Permissions needed to access this app' },
        { field: 'sharing', widget: 'json', helpText: 'Public/internal/restricted access control' },
        { field: 'embed', widget: 'json', helpText: 'iFrame embed configuration' },
        { field: 'aria', widget: 'json', helpText: 'Accessibility labels' },
      ],
    },
  ],
});
