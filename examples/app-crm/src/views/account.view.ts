// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec/ui';

/**
 * Account Views
 *
 *   • grid    — primary list with revenue / industry summaries
 *   • gallery — branded account cards with brand_color highlights
 *   • map     — geospatial distribution (uses office_location)
 */
export const AccountViews = defineView({
  list: {
    type: 'grid',
    name: 'all_accounts',
    label: 'All Accounts',
    data: { provider: 'object', object: 'account' },
    columns: [
      { field: 'name', width: 220, sortable: true, link: true, pinned: 'left' },
      { field: 'account_number', width: 140 },
      { field: 'industry', width: 140, sortable: true },
      { field: 'annual_revenue', width: 160, align: 'right', summary: 'sum' },
      { field: 'number_of_employees', width: 130, align: 'right', summary: 'avg' },
      { field: 'phone', width: 150 },
      { field: 'website', width: 200 },
      { field: 'owner', width: 150 },
      { field: 'is_active', width: 100, align: 'center' },
    ],
    sort: [{ field: 'annual_revenue', order: 'desc' }],
    grouping: { fields: [{ field: 'industry', order: 'asc', collapsed: false }] },
    rowColor: { field: 'is_active', colors: { true: '#16a34a', false: '#94a3b8' } },
    selection: { type: 'multiple' },
    pagination: { pageSize: 50, pageSizeOptions: [25, 50, 100] },
    exportOptions: ['csv', 'xlsx'],
    appearance: {
      showDescription: true,
      allowedVisualizations: ['grid', 'gallery', 'map'],
    },
    tabs: [
      { name: 'all', label: 'All', view: 'all_accounts', isDefault: true, pinned: true },
      { name: 'cards', label: 'Cards', icon: 'gallery-thumbnails', view: 'account_gallery' },
      { name: 'map', label: 'Map', icon: 'map', view: 'account_map' },
      { name: 'enterprise', label: 'Enterprise', icon: 'crown', view: 'enterprise_accounts' },
      { name: 'mine', label: 'My Accounts', icon: 'user', view: 'my_accounts' },
    ],
  },

  listViews: {
    /** Branded account cards */
    account_gallery: {
      name: 'account_gallery',
      type: 'gallery',
      label: 'Account Cards',
      data: { provider: 'object', object: 'account' },
      columns: ['name', 'industry', 'annual_revenue', 'phone'],
      gallery: {
        cardSize: 'medium',
        titleField: 'name',
        visibleFields: ['industry', 'annual_revenue', 'number_of_employees', 'phone', 'website', 'owner'],
      },
    },

    /** Geospatial distribution */
    account_map: {
      name: 'account_map',
      type: 'map',
      label: 'Accounts by Location',
      data: { provider: 'object', object: 'account' },
      columns: ['name', 'industry', 'office_location', 'billing_address'],
    },

    /** Tier accounts: Enterprise (>= $10M ARR) */
    enterprise_accounts: {
      name: 'enterprise_accounts',
      type: 'grid',
      label: 'Enterprise Accounts',
      data: { provider: 'object', object: 'account' },
      columns: ['name', 'industry', 'annual_revenue', 'number_of_employees', 'owner'],
      filter: [{ field: 'annual_revenue', operator: 'greater_than_or_equal', value: 10000000 }],
      sort: [{ field: 'annual_revenue', order: 'desc' }],
    },

    my_accounts: {
      name: 'my_accounts',
      type: 'grid',
      label: 'My Accounts',
      data: { provider: 'object', object: 'account' },
      columns: ['name', 'industry', 'annual_revenue', 'phone', 'last_activity_date'],
      filter: [{ field: 'owner', operator: 'equals', value: '{current_user_id}' }],
      sort: [{ field: 'last_activity_date', order: 'desc' }],
    },
  },

  form: {
    type: 'tabbed',
    data: { provider: 'object', object: 'account' },
    sections: [
      {
        label: 'Profile',
        columns: 2,
        fields: [
          { field: 'name', required: true, colSpan: 2 },
          'account_number',
          'industry',
          'phone',
          'website',
          'owner',
          'parent_account',
          'is_active',
          'brand_color',
        ],
      },
      {
        label: 'Financials',
        columns: 2,
        fields: ['annual_revenue', 'number_of_employees'],
      },
      {
        label: 'Locations',
        columns: 1,
        fields: ['billing_address', 'office_location'],
      },
      {
        label: 'Description',
        columns: 1,
        fields: ['description'],
      },
    ],
  },
});
