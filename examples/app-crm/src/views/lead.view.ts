// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec/ui';

/**
 * Lead Views - Comprehensive UI Showcase
 * 
 * This file demonstrates:
 * 1. All 6 FormView layout types (simple, tabbed, wizard, split, drawer, modal)
 * 2. Section features (collapsible, 1-4 column layouts)
 * 3. Field-level controls (readonly, required, hidden, colSpan, visibleOn, dependsOn, custom widget)
 * 4. Multiple named formViews for different scenarios
 * 5. Various list view types
 */
export const LeadViews = defineView({
  /**
   * Default List View - Grid with Advanced Features
   */
  list: {
    type: 'grid',
    name: 'all_leads',
    label: 'All Leads',
    data: {
      provider: 'object',
      object: 'lead',
    },
    
    // Column Configuration with Enhanced Features
    columns: [
      {
        field: 'first_name',
        label: 'First Name',
        width: 150,
        sortable: true,
        link: true, // Primary navigation link
      },
      {
        field: 'last_name',
        label: 'Last Name',
        width: 150,
        sortable: true,
      },
      {
        field: 'company',
        label: 'Company',
        width: 200,
        sortable: true,
      },
      {
        field: 'email',
        label: 'Email',
        width: 200,
      },
      {
        field: 'status',
        label: 'Status',
        width: 120,
        sortable: true,
      },
      {
        field: 'rating',
        label: 'Score',
        width: 100,
        align: 'center',
      },
      {
        field: 'lead_source',
        label: 'Source',
        width: 120,
      },
      {
        field: 'owner',
        label: 'Owner',
        width: 150,
      },
    ],
    
    sort: [
      { field: 'created_at', order: 'desc' }
    ],
    
    // Quick Filters (Salesforce-style)
    quickFilters: [
      {
        field: 'status',
        label: 'New',
        operator: 'equals',
        value: 'new',
      },
      {
        field: 'status',
        label: 'Contacted',
        operator: 'equals',
        value: 'contacted',
      },
      {
        field: 'owner',
        label: 'My Leads',
        operator: 'equals',
        value: '{current_user_id}',
      },
    ],
    
    // Navigation to Form
    navigation: {
      mode: 'page',
      view: 'detail_form', // Use named form view
    },
    
    // List Actions
    rowActions: ['edit', 'delete', 'convert_lead'],
    bulkActions: ['mass_update', 'mass_delete', 'assign_owner'],
    
    // Features
    selection: { type: 'multiple' },
    pagination: { pageSize: 25, pageSizeOptions: [10, 25, 50, 100] },
    rowHeight: 'medium',
    inlineEdit: true,
    exportOptions: ['csv', 'xlsx'],
    
    // Empty State
    emptyState: {
      title: 'No Leads Yet',
      message: 'Get started by creating your first lead',
      icon: 'user-plus',
    },
  },
  
  /**
   * Default Form View - SIMPLE Layout
   * Basic sectioned form with collapsible sections and column layouts
   */
  form: {
    type: 'simple',
    data: {
      provider: 'object',
      object: 'lead',
    },
    
    sections: [
      {
        label: 'Contact Information',
        collapsible: true,
        collapsed: false,
        columns: 2, // 2-column layout
        fields: [
          {
            field: 'salutation',
            colSpan: 1,
          },
          {
            field: 'first_name',
            required: true,
            colSpan: 1,
          },
          {
            field: 'last_name',
            required: true,
            colSpan: 2, // Span both columns
          },
          'company',
          'title',
          'email',
          'phone',
          'mobile',
          'website',
        ],
      },
      {
        label: 'Lead Classification',
        collapsible: true,
        collapsed: false,
        columns: 3, // 3-column layout
        fields: [
          {
            field: 'status',
            required: true,
          },
          {
            field: 'rating',
            widget: 'star_rating', // Custom widget
          },
          'lead_source',
          'industry',
          {
            field: 'owner',
            required: true,
          },
        ],
      },
      {
        label: 'Company Information',
        collapsible: true,
        collapsed: true, // Collapsed by default
        columns: 2,
        fields: [
          'annual_revenue',
          'number_of_employees',
        ],
      },
      {
        label: 'Address',
        collapsible: true,
        collapsed: true,
        columns: 2,
        fields: [
          {
            field: 'street',
            colSpan: 2, // Full width
          },
          'city',
          'state',
          'postal_code',
          'country',
        ],
      },
      {
        label: 'Additional Information',
        collapsible: true,
        collapsed: true,
        columns: 1, // Single column for text areas
        fields: [
          'description',
          'notes',
        ],
      },
      {
        label: 'Privacy',
        collapsible: true,
        collapsed: true,
        columns: 2,
        fields: [
          'do_not_call',
          'email_opt_out',
        ],
      },
    ],
  },
  
  /**
   * Additional Named List Views
   */
  listViews: {
    /**
     * Kanban Board View
     */
    kanban_by_status: {
      name: 'kanban_by_status',
      type: 'kanban',
      label: 'Lead Pipeline',
      data: {
        provider: 'object',
        object: 'lead',
      },
      columns: ['first_name', 'last_name', 'company', 'email'],
      kanban: {
        groupByField: 'status',
        summarizeField: 'annual_revenue',
        columns: ['first_name', 'last_name', 'company', 'rating'],
      },
      navigation: {
        mode: 'drawer', // Open in drawer instead of new page
        width: '600px',
      },
    },
    
    /**
     * Calendar View
     */
    calendar_by_created: {
      name: 'calendar_by_created',
      type: 'calendar',
      label: 'Lead Calendar',
      data: {
        provider: 'object',
        object: 'lead',
      },
      columns: ['first_name', 'last_name', 'company'],
      calendar: {
        startDateField: 'created_at',
        titleField: 'company',
        colorField: 'status',
      },
    },
    
    /**
     * Gallery/Card View
     */
    gallery_view: {
      name: 'gallery_view',
      type: 'gallery',
      label: 'Lead Cards',
      data: {
        provider: 'object',
        object: 'lead',
      },
      columns: ['first_name', 'last_name', 'company', 'email', 'status'],
      gallery: {
        cardSize: 'medium',
        titleField: 'company',
        visibleFields: ['first_name', 'last_name', 'email', 'phone', 'status', 'rating'],
      },
    },
    
    /**
     * My Leads - Filtered View
     */
    my_leads: {
      name: 'my_leads',
      type: 'grid',
      label: 'My Leads',
      data: {
        provider: 'object',
        object: 'lead',
      },
      columns: ['first_name', 'last_name', 'company', 'email', 'status', 'rating'],
      filter: [
        ['owner', '=', '{current_user_id}']
      ],
      sort: [
        { field: 'rating', order: 'desc' },
        { field: 'created_at', order: 'desc' }
      ],
    },
    
    /**
     * High Priority Leads
     */
    high_priority: {
      name: 'high_priority',
      type: 'grid',
      label: 'High Priority',
      data: {
        provider: 'object',
        object: 'lead',
      },
      columns: ['first_name', 'last_name', 'company', 'email', 'status', 'rating', 'lead_source'],
      filter: [
        ['rating', '>=', 4],
        ['status', 'in', ['new', 'contacted']]
      ],
      rowColor: {
        field: 'rating',
        colors: {
          '5': '#00AA00',
          '4': '#FFA500',
        },
      },
    },
  },
  
  /**
   * Additional Named Form Views - Demonstrating All 6 Layout Types
   */
  formViews: {
    /**
     * 1. SIMPLE Layout (already shown as default form above)
     * Basic sectioned form
     */
    quick_create: {
      type: 'simple',
      data: {
        provider: 'object',
        object: 'lead',
      },
      sections: [
        {
          label: 'Quick Lead Creation',
          columns: 2,
          fields: [
            { field: 'first_name', required: true },
            { field: 'last_name', required: true },
            { field: 'company', required: true, colSpan: 2 },
            { field: 'email', required: true },
            'phone',
            'status',
            'owner',
          ],
        },
      ],
    },
    
    /**
     * 2. TABBED Layout
     * Organize complex forms with tabs
     */
    detail_form: {
      type: 'tabbed',
      data: {
        provider: 'object',
        object: 'lead',
      },
      sections: [
        {
          label: 'General',
          columns: 2,
          fields: [
            'salutation',
            'first_name',
            'last_name',
            'company',
            'title',
            'email',
            'phone',
            'mobile',
          ],
        },
        {
          label: 'Qualification',
          columns: 2,
          fields: [
            { field: 'status', required: true },
            { field: 'rating', widget: 'star_rating' },
            'lead_source',
            'industry',
            'annual_revenue',
            'number_of_employees',
          ],
        },
        {
          label: 'Address',
          columns: 2,
          fields: [
            { field: 'street', colSpan: 2 },
            'city',
            {
              field: 'state',
              dependsOn: 'country', // Cascade: country determines available states
            },
            'postal_code',
            'country',
          ],
        },
        {
          label: 'Details',
          columns: 1,
          fields: [
            'description',
            'notes',
            'do_not_call',
            'email_opt_out',
          ],
        },
      ],
    },
    
    /**
     * 3. WIZARD Layout
     * Step-by-step guided process
     */
    lead_conversion_wizard: {
      type: 'wizard',
      data: {
        provider: 'object',
        object: 'lead',
      },
      sections: [
        {
          label: 'Step 1: Contact Details',
          columns: 2,
          fields: [
            { field: 'first_name', required: true, readonly: true },
            { field: 'last_name', required: true, readonly: true },
            { field: 'email', readonly: true, colSpan: 2 },
            'phone',
            'mobile',
          ],
        },
        {
          label: 'Step 2: Company Information',
          columns: 2,
          fields: [
            { field: 'company', required: true, readonly: true },
            'title',
            'industry',
            'annual_revenue',
            'number_of_employees',
            'website',
          ],
        },
        {
          label: 'Step 3: Qualification',
          columns: 2,
          fields: [
            { field: 'status', required: true },
            { field: 'rating', widget: 'star_rating' },
            'lead_source',
            {
              field: 'owner',
              visibleOn: 'rating >= 4', // Conditional visibility
            },
          ],
        },
        {
          label: 'Step 4: Review & Convert',
          columns: 1,
          fields: [
            {
              field: 'description',
              helpText: 'Review all information before converting to Account and Contact',
            },
          ],
        },
      ],
    },
    
    /**
     * 4. SPLIT Layout
     * Master-detail split view
     */
    split_edit: {
      type: 'split',
      data: {
        provider: 'object',
        object: 'lead',
      },
      sections: [
        {
          label: 'Primary Information',
          columns: 1,
          fields: [
            'first_name',
            'last_name',
            'company',
            'email',
            { field: 'status', required: true },
            'owner',
          ],
        },
        {
          label: 'Extended Details',
          columns: 2,
          fields: [
            'phone',
            'mobile',
            'title',
            'industry',
            'lead_source',
            { field: 'rating', widget: 'star_rating' },
            'annual_revenue',
            'number_of_employees',
          ],
        },
      ],
    },
    
    /**
     * 5. DRAWER Layout
     * Side panel form (typically opened from list view)
     */
    quick_edit_drawer: {
      type: 'drawer',
      data: {
        provider: 'object',
        object: 'lead',
      },
      sections: [
        {
          label: 'Quick Edit',
          columns: 1, // Drawers typically use single column
          fields: [
            { field: 'first_name', required: true },
            { field: 'last_name', required: true },
            'company',
            'email',
            'phone',
            { field: 'status', required: true },
            { field: 'rating', widget: 'star_rating' },
            'lead_source',
            {
              field: 'owner',
              visibleOn: 'status != "new"', // Only show owner after initial contact
            },
          ],
        },
      ],
    },
    
    /**
     * 6. MODAL Layout
     * Dialog-based form for quick actions
     */
    status_update_modal: {
      type: 'modal',
      data: {
        provider: 'object',
        object: 'lead',
      },
      sections: [
        {
          label: 'Update Lead Status',
          columns: 1,
          fields: [
            { field: 'first_name', readonly: true },
            { field: 'last_name', readonly: true },
            { field: 'company', readonly: true },
            { 
              field: 'status', 
              required: true,
              helpText: 'Select the new status for this lead',
            },
            {
              field: 'rating',
              widget: 'star_rating',
              visibleOn: 'status == "qualified"', // Only show rating for qualified leads
            },
            {
              field: 'notes',
              placeholder: 'Add notes about this status change',
              visibleOn: 'status == "unqualified"', // Require notes for unqualified
            },
          ],
        },
      ],
    },
    
    /**
     * Advanced Example: Conditional Field Visibility & Dependencies
     */
    advanced_conditional: {
      type: 'simple',
      data: {
        provider: 'object',
        object: 'lead',
      },
      sections: [
        {
          label: 'Lead Information',
          columns: 2,
          fields: [
            'first_name',
            'last_name',
            'company',
            'email',
            'status',
            'lead_source',
            {
              field: 'rating',
              widget: 'star_rating',
              visibleOn: 'status != "new"', // Only show after first contact
            },
            {
              field: 'industry',
              dependsOn: 'company', // Industry options depend on company
            },
            {
              field: 'annual_revenue',
              visibleOn: 'rating >= 3', // Only for qualified leads
            },
            {
              field: 'number_of_employees',
              visibleOn: 'rating >= 3',
            },
            {
              field: 'owner',
              required: true,
              visibleOn: 'status == "contacted" || status == "qualified"',
            },
            {
              field: 'notes',
              colSpan: 2,
              required: true,
              visibleOn: 'status == "unqualified"', // Require explanation for unqualified
            },
          ],
        },
        {
          label: 'Address Information',
          collapsible: true,
          collapsed: true,
          columns: 2,
          fields: [
            { field: 'street', colSpan: 2 },
            'city',
            {
              field: 'state',
              dependsOn: 'country', // Country determines state options
            },
            'postal_code',
            'country',
          ],
        },
        {
          label: 'Privacy Preferences',
          collapsible: true,
          collapsed: true,
          columns: 2,
          fields: [
            {
              field: 'do_not_call',
              helpText: 'Check if this lead has requested not to be called',
            },
            {
              field: 'email_opt_out',
              helpText: 'Check if this lead has opted out of email communications',
            },
          ],
        },
      ],
    },
  },
});
