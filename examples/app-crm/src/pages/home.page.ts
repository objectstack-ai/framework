// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Page } from '@objectstack/spec/ui';

/**
 * Sales Home Page
 * 
 * Demonstrates a home page layout with dashboards and quick access widgets.
 * Similar to Salesforce Lightning Home Page.
 * 
 * Features:
 * - Dashboard-style layout
 * - Multiple component regions
 * - Global search and notifications
 * - Quick action cards
 */
export const SalesHomePage: Page = {
  name: 'sales_home_page',
  label: 'Sales Home',
  description: 'Sales team home page with key metrics and quick actions',
  
  type: 'home',
  
  template: 'three-column',
  
  variables: [
    {
      name: 'selectedPeriod',
      type: 'string',
      defaultValue: 'this_month',
    },
  ],
  
  regions: [
    {
      name: 'header',
      width: 'full',
      components: [
        {
          type: 'page:header',
          id: 'home_header',
          label: 'Sales Home Header',
          properties: {
            title: 'Sales Dashboard',
            subtitle: 'Welcome back, {current_user.first_name}',
            icon: 'home',
            breadcrumb: false,
          },
        },
      ],
    },
    
    {
      name: 'left_sidebar',
      width: 'small',
      components: [
        {
          type: 'page:card',
          id: 'quick_create',
          label: 'Quick Create',
          properties: {
            title: 'Quick Create',
            bordered: true,
            body: [
              {
                type: 'nav:menu',
                id: 'create_menu',
                properties: {},
              },
            ],
          },
        },
        {
          type: 'page:card',
          id: 'my_recent_items',
          label: 'Recent Items',
          properties: {
            title: 'Recent Items',
            bordered: true,
          },
        },
      ],
    },
    
    {
      name: 'main',
      width: 'large',
      components: [
        {
          type: 'page:card',
          id: 'key_metrics',
          label: 'Key Metrics',
          properties: {
            title: 'Key Performance Indicators',
            bordered: false,
            body: [
              {
                type: 'record:highlights',
                id: 'kpi_highlights',
                properties: {
                  fields: ['total_revenue', 'deals_won', 'pipeline_value', 'conversion_rate'],
                  layout: 'horizontal',
                },
              },
            ],
          },
        },
        {
          type: 'page:tabs',
          id: 'home_tabs',
          label: 'Home Tabs',
          properties: {
            type: 'card',
            position: 'top',
            items: [
              {
                label: 'My Leads',
                icon: 'user-plus',
                children: [
                  {
                    type: 'page:section',
                    properties: {},
                  },
                ],
              },
              {
                label: 'My Opportunities',
                icon: 'dollar-sign',
                children: [
                  {
                    type: 'page:section',
                    properties: {},
                  },
                ],
              },
              {
                label: 'My Tasks',
                icon: 'list-checks',
                children: [
                  {
                    type: 'page:section',
                    properties: {},
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    
    {
      name: 'right_sidebar',
      width: 'medium',
      components: [
        {
          type: 'ai:chat_window',
          id: 'sales_assistant',
          label: 'Sales Assistant',
          properties: {
            mode: 'sidebar',
            agentId: 'sales_assistant',
            context: {
              page: 'home',
              user: '{current_user.id}',
            },
          },
        },
        {
          type: 'page:card',
          id: 'upcoming_events',
          label: 'Calendar',
          properties: {
            title: "Today's Schedule",
            bordered: true,
          },
        },
      ],
    },
  ],
  
  isDefault: true,
  assignedProfiles: ['sales_user', 'sales_manager'],
  
  aria: {
    ariaLabel: 'Sales Home Page',
    ariaDescribedBy: 'Sales team home page with metrics, leads, and quick actions',
  },
};
