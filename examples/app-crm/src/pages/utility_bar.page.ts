// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Page } from '@objectstack/spec/ui';

/**
 * Utility Bar Page
 * 
 * Demonstrates a utility bar page for floating panels and quick access tools.
 * Similar to Salesforce Lightning Utility Bar.
 * 
 * Features:
 * - Floating utility panels
 * - Quick notes
 * - Chat/messaging
 * - Notifications
 */
export const UtilityBarPage: Page = {
  name: 'utility_bar_page',
  label: 'Utility Bar',
  description: 'Quick access utility bar with floating tools',
  
  type: 'utility',
  
  template: 'utility-bar',
  
  regions: [
    {
      name: 'utilities',
      width: 'full',
      components: [
        {
          type: 'global:notifications',
          id: 'notifications_panel',
          label: 'Notifications',
          properties: {},
        },
        {
          type: 'ai:chat_window',
          id: 'quick_chat',
          label: 'Quick Chat',
          properties: {
            mode: 'float',
            agentId: 'general_assistant',
          },
        },
        {
          type: 'page:card',
          id: 'quick_notes',
          label: 'Quick Notes',
          properties: {
            title: 'Quick Notes',
            bordered: true,
          },
        },
        {
          type: 'global:search',
          id: 'quick_search',
          label: 'Quick Search',
          properties: {},
        },
      ],
    },
  ],
  
  isDefault: false,
  assignedProfiles: ['sales_user', 'sales_manager', 'service_user', 'system_administrator'],
  
  aria: {
    ariaLabel: 'Utility Bar',
    ariaDescribedBy: 'Quick access utility bar with floating tools and notifications',
  },
};
