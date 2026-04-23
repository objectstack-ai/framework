// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineApp } from '@objectstack/spec/ui';

/**
 * CRM App with full navigation tree
 * 
 * Demonstrates:
 * - Unlimited nesting depth via `type: 'group'` items
 * - Pages referenced by name via `type: 'page'` items
 * - Sub-groups within groups (Lead Review nested under Sales Cloud)
 * - Global utility entries (Settings, Help) at sidebar bottom
 */
export const CrmAppModern = defineApp({
  name: 'crm',
  label: 'Sales CRM',
  description: 'Enterprise CRM with nested navigation tree',
  icon: 'briefcase',

  branding: {
    primaryColor: '#4169E1',
    logo: '/assets/crm-logo.png',
    favicon: '/assets/crm-favicon.ico',
  },

  navigation: [
    // ── Sales Cloud ──
    {
      id: 'grp_sales',
      type: 'group',
      label: 'Sales Cloud',
      icon: 'briefcase',
      expanded: true,
      children: [
        { id: 'nav_pipeline', type: 'page', label: 'Pipeline', icon: 'columns', pageName: 'page_pipeline' },
        { id: 'nav_accounts', type: 'page', label: 'Accounts', icon: 'building', pageName: 'page_accounts' },
        { id: 'nav_leads', type: 'page', label: 'Leads', icon: 'user-plus', pageName: 'page_leads' },
        // Nested sub-group — impossible with the old Interface model
        {
          id: 'grp_review',
          type: 'group',
          label: 'Lead Review',
          icon: 'clipboard-check',
          expanded: false,
          children: [
            { id: 'nav_review_queue', type: 'page', label: 'Review Queue', icon: 'check-square', pageName: 'page_review_queue' },
            { id: 'nav_qualified', type: 'page', label: 'Qualified', icon: 'check-circle', pageName: 'page_qualified' },
          ],
        },
      ],
    },

    // ── Analytics ──
    {
      id: 'grp_analytics',
      type: 'group',
      label: 'Analytics',
      icon: 'chart-line',
      expanded: false,
      children: [
        { id: 'nav_overview', type: 'page', label: 'Overview', icon: 'gauge', pageName: 'page_overview' },
        { id: 'nav_pipeline_report', type: 'page', label: 'Pipeline Report', icon: 'chart-bar', pageName: 'page_pipeline_report' },
      ],
    },

    // ── Global Utility ──
    { id: 'nav_settings', type: 'page', label: 'Settings', icon: 'settings', pageName: 'admin_settings' },
    { id: 'nav_help', type: 'url', label: 'Help', icon: 'help-circle', url: 'https://help.example.com', target: '_blank' },
  ],

  homePageId: 'nav_pipeline',
  requiredPermissions: ['app.access.crm'],
  isDefault: true,
});
