// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

export const Account = ObjectSchema.create({
  name: 'account',
  label: 'Account',
  pluralLabel: 'Accounts',
  icon: 'building',
  description: 'Companies and organizations doing business with us',
  titleFormat: '{account_number} - {name}',
  compactLayout: ['account_number', 'name', 'type', 'owner'],
  
  fields: {
    // AutoNumber field - Unique account identifier
    account_number: Field.autonumber({
      label: 'Account Number',
      format: 'ACC-{0000}',
    }),
    
    // Basic Information
    name: Field.text({ 
      label: 'Account Name', 
      required: true, 
      searchable: true,
      maxLength: 255,
    }),
    
    // Select fields with custom options
    type: Field.select({
      label: 'Account Type',
      options: [
        { label: 'Prospect', value: 'prospect', color: '#FFA500', default: true },
        { label: 'Customer', value: 'customer', color: '#00AA00' },
        { label: 'Partner', value: 'partner', color: '#0000FF' },
        { label: 'Former Customer', value: 'former', color: '#999999' },
      ]
    }),
    
    industry: Field.select({
      label: 'Industry',
      options: [
        { label: 'Technology', value: 'technology' },
        { label: 'Finance', value: 'finance' },
        { label: 'Healthcare', value: 'healthcare' },
        { label: 'Retail', value: 'retail' },
        { label: 'Manufacturing', value: 'manufacturing' },
        { label: 'Education', value: 'education' },
      ]
    }),
    
    // Number fields
    annual_revenue: Field.currency({ 
      label: 'Annual Revenue',
      scale: 2,
      min: 0,
    }),
    
    number_of_employees: Field.number({
      label: 'Employees',
      min: 0,
    }),
    
    // Contact Information
    phone: Field.text({ 
      label: 'Phone',
      format: 'phone',
    }),
    
    website: Field.url({
      label: 'Website',
    }),
    
    // Structured Address field (new field type)
    billing_address: Field.address({
      label: 'Billing Address',
      addressFormat: 'international',
    }),
    
    // Office Location (new field type)
    office_location: Field.location({
      label: 'Office Location',
      displayMap: true,
      allowGeocoding: true,
    }),
    
    // Relationship fields
    owner: Field.lookup('user', {
      label: 'Account Owner',
      required: true,
    }),
    
    parent_account: Field.lookup('account', {
      label: 'Parent Account',
      description: 'Parent company in hierarchy',
    }),
    
    // Rich text field
    description: Field.markdown({
      label: 'Description',
    }),
    
    // Boolean field
    is_active: Field.boolean({
      label: 'Active',
      defaultValue: true,
    }),
    
    // Date field
    last_activity_date: Field.date({
      label: 'Last Activity Date',
      readonly: true,
    }),
    
    // Brand color (new field type)
    brand_color: Field.color({
      label: 'Brand Color',
      colorFormat: 'hex',
      presetColors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'],
    }),
  },
  
  // Database indexes for performance
  indexes: [
    { fields: ['name'], type: 'btree' },
    { fields: ['owner'], type: 'btree' },
    { fields: ['type', 'is_active'], type: 'btree' },
  ],
  
  // Enable advanced features
  enable: {
    trackHistory: true,     // Track field changes
    searchable: true,       // Include in global search
    apiEnabled: true,       // Expose via REST/GraphQL
    apiMethods: ['get', 'list', 'create', 'update', 'delete', 'search', 'export'], // Whitelist allowed API operations
    files: true,            // Allow file attachments
    feeds: true,            // Enable activity feed/chatter (Chatter-like)
    activities: true,       // Enable tasks and events tracking
    trash: true,            // Recycle bin support
    mru: true,              // Track Most Recently Used
  },
  
  // Validation Rules
  validations: [
    {
      name: 'revenue_positive',
      type: 'script',
      severity: 'error',
      message: 'Annual Revenue must be positive',
      condition: 'annual_revenue < 0',
    },
    {
      name: 'account_name_unique',
      type: 'unique',
      severity: 'error',
      message: 'Account name must be unique',
      fields: ['name'],
      caseSensitive: false,
    },
  ],
  
  // Workflow Rules
  workflows: [
    {
      name: 'update_last_activity',
      objectName: 'account',
      triggerType: 'on_update',
      criteria: 'ISCHANGED(owner) OR ISCHANGED(type)',
      actions: [
        {
          name: 'set_activity_date',
          type: 'field_update',
          field: 'last_activity_date',
          value: 'TODAY()',
        }
      ],
      active: true,
    }
  ],
});