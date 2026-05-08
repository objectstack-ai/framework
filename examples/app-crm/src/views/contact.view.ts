// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec/ui';

/**
 * Contact Views
 *
 *   • grid    — primary roster with avatar
 *   • gallery — people directory cards (avatar as cover)
 */
export const ContactViews = defineView({
  list: {
    type: 'grid',
    name: 'all_contacts',
    label: 'All Contacts',
    data: { provider: 'object', object: 'contact' },
    columns: [
      { field: 'avatar', width: 64, align: 'center' },
      { field: 'first_name', width: 140, sortable: true, link: true },
      { field: 'last_name', width: 140, sortable: true },
      { field: 'account', width: 200 },
      { field: 'title', width: 180 },
      { field: 'department', width: 140 },
      { field: 'email', width: 220 },
      { field: 'phone', width: 150 },
      { field: 'owner', width: 150 },
    ],
    sort: [{ field: 'last_name', order: 'asc' }],
    grouping: { fields: [{ field: 'account', order: 'asc', collapsed: true }] },
    selection: { type: 'multiple' },
    pagination: { pageSize: 50, pageSizeOptions: [25, 50, 100] },
    exportOptions: ['csv', 'xlsx'],
    appearance: {
      showDescription: true,
      allowedVisualizations: ['grid', 'gallery'],
    },
    tabs: [
      { name: 'all', label: 'All', view: 'all_contacts', isDefault: true, pinned: true },
      { name: 'directory', label: 'Directory', icon: 'gallery-thumbnails', view: 'contact_directory' },
      { name: 'primary', label: 'Primary', icon: 'star', view: 'primary_contacts' },
    ],
  },

  listViews: {
    /** People directory */
    contact_directory: {
      name: 'contact_directory',
      type: 'gallery',
      label: 'People Directory',
      data: { provider: 'object', object: 'contact' },
      columns: ['first_name', 'last_name', 'title', 'email'],
      gallery: {
        coverField: 'avatar',
        coverFit: 'cover',
        cardSize: 'small',
        titleField: 'last_name',
        visibleFields: ['first_name', 'title', 'department', 'email', 'phone', 'account'],
      },
    },

    primary_contacts: {
      name: 'primary_contacts',
      type: 'grid',
      label: 'Primary Contacts',
      data: { provider: 'object', object: 'contact' },
      columns: ['first_name', 'last_name', 'account', 'title', 'email', 'phone'],
      filter: [{ field: 'is_primary', operator: 'equals', value: true }],
      sort: [{ field: 'account', order: 'asc' }],
    },
  },

  form: {
    type: 'tabbed',
    data: { provider: 'object', object: 'contact' },
    sections: [
      {
        label: 'Identity',
        columns: 2,
        fields: [
          'salutation',
          { field: 'first_name', required: true },
          { field: 'last_name', required: true, colSpan: 2 },
          { field: 'account', required: true },
          'title',
          'department',
          'reports_to',
          'owner',
        ],
      },
      {
        label: 'Contact Info',
        columns: 2,
        fields: ['email', 'phone', 'mobile', 'birthdate', 'avatar'],
      },
      {
        label: 'Preferences',
        columns: 2,
        fields: ['lead_source', 'is_primary', 'do_not_call', 'email_opt_out'],
      },
    ],
  },
});
