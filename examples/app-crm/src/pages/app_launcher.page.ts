// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Page } from '@objectstack/spec/ui';

/**
 * App Launcher Page
 * 
 * Demonstrates an application launcher page similar to Salesforce App Launcher.
 * 
 * Features:
 * - Grid-based app icon layout
 * - Global search
 * - Quick access to all apps
 */
export const AppLauncherPage: Page = {
  name: 'app_launcher_page',
  label: 'App Launcher',
  description: 'Central hub for accessing all applications',
  
  type: 'app',
  
  template: 'centered',
  
  regions: [
    {
      name: 'header',
      width: 'full',
      components: [
        {
          type: 'global:search',
          id: 'app_search',
          label: 'Search Apps',
          properties: {},
        },
      ],
    },
    
    {
      name: 'main',
      width: 'large',
      components: [
        {
          type: 'page:header',
          id: 'launcher_header',
          label: 'App Launcher Header',
          properties: {
            title: 'App Launcher',
            subtitle: 'Select an app to get started',
            icon: 'th',
            breadcrumb: false,
          },
        },
        {
          type: 'app:launcher',
          id: 'app_grid',
          label: 'Application Grid',
          properties: {},
        },
      ],
    },
  ],
  
  isDefault: false,
  assignedProfiles: ['sales_user', 'sales_manager', 'service_user', 'system_administrator'],
  
  aria: {
    ariaLabel: 'App Launcher Page',
    ariaDescribedBy: 'Central application launcher for accessing all apps',
  },
};
