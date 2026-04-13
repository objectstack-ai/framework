// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';
import { LeadStateMachine } from './lead.state';

export const Lead = ObjectSchema.create({
  name: 'lead',
  label: 'Lead',
  pluralLabel: 'Leads',
  icon: 'user-plus',
  description: 'Potential customers not yet qualified',
  
  fields: {
    // Personal Information
    salutation: Field.select({
      label: 'Salutation',
      options: [
        { label: 'Mr.', value: 'mr' },
        { label: 'Ms.', value: 'ms' },
        { label: 'Mrs.', value: 'mrs' },
        { label: 'Dr.', value: 'dr' },
      ]
    }),
    
    first_name: Field.text({
      label: 'First Name',
      required: true,
      searchable: true,
    }),
    
    last_name: Field.text({
      label: 'Last Name',
      required: true,
      searchable: true,
    }),
    
    full_name: Field.formula({
      label: 'Full Name',
      expression: 'CONCAT(salutation, " ", first_name, " ", last_name)',
    }),
    
    // Company Information
    company: Field.text({
      label: 'Company',
      required: true,
      searchable: true,
    }),
    
    title: Field.text({
      label: 'Job Title',
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
    
    // Contact Information
    email: Field.email({
      label: 'Email',
      required: true,
      unique: true,
    }),
    
    phone: Field.text({
      label: 'Phone',
      format: 'phone',
    }),
    
    mobile: Field.text({
      label: 'Mobile',
      format: 'phone',
    }),
    
    website: Field.url({
      label: 'Website',
    }),
    
    // Lead Qualification
    status: Field.select({
      label: 'Lead Status',
      required: true,
      options: [
        { label: 'New', value: 'new', color: '#808080', default: true },
        { label: 'Contacted', value: 'contacted', color: '#FFA500' },
        { label: 'Qualified', value: 'qualified', color: '#4169E1' },
        { label: 'Unqualified', value: 'unqualified', color: '#FF0000' },
        { label: 'Converted', value: 'converted', color: '#00AA00' },
      ]
    }),
    
    rating: Field.rating(5, {
      label: 'Lead Score',
      description: 'Lead quality score (1-5 stars)',
      allowHalf: true,
    }),
    
    lead_source: Field.select({
      label: 'Lead Source',
      options: [
        { label: 'Web', value: 'web' },
        { label: 'Referral', value: 'referral' },
        { label: 'Event', value: 'event' },
        { label: 'Partner', value: 'partner' },
        { label: 'Advertisement', value: 'advertisement' },
        { label: 'Cold Call', value: 'cold_call' },
      ]
    }),
    
    // Assignment
    owner: Field.lookup('user', {
      label: 'Lead Owner',
      required: true,
    }),
    
    // Conversion tracking
    is_converted: Field.boolean({
      label: 'Converted',
      defaultValue: false,
      readonly: true,
    }),
    
    converted_account: Field.lookup('account', {
      label: 'Converted Account',
      readonly: true,
    }),
    
    converted_contact: Field.lookup('contact', {
      label: 'Converted Contact',
      readonly: true,
    }),
    
    converted_opportunity: Field.lookup('opportunity', {
      label: 'Converted Opportunity',
      readonly: true,
    }),
    
    converted_date: Field.datetime({
      label: 'Converted Date',
      readonly: true,
    }),
    
    // Address (using new address field type)
    address: Field.address({
      label: 'Address',
      addressFormat: 'international',
    }),
    
    // Additional Info
    annual_revenue: Field.currency({
      label: 'Annual Revenue',
      scale: 2,
    }),
    
    number_of_employees: Field.number({
      label: 'Number of Employees',
    }),
    
    description: Field.markdown({
      label: 'Description',
    }),
    
    // Custom notes with rich text formatting
    notes: Field.richtext({
      label: 'Notes',
      description: 'Rich text notes with formatting',
    }),
    
    // Flags
    do_not_call: Field.boolean({
      label: 'Do Not Call',
      defaultValue: false,
    }),
    
    email_opt_out: Field.boolean({
      label: 'Email Opt Out',
      defaultValue: false,
    }),
  },

  // Lifecycle State Machine(s)
  // Enforces valid status transitions to prevent AI hallucinations
  // Using `stateMachines` (plural) for future extensibility.
  // For simple objects with one lifecycle, `stateMachine` (singular) is also supported.
  stateMachines: {
    lifecycle: LeadStateMachine,
  },
  
  // Database indexes for performance
  indexes: [
    { fields: ['email'], type: 'btree', unique: true },
    { fields: ['owner'], type: 'btree' },
    { fields: ['status'], type: 'btree' },
    { fields: ['company'], type: 'btree' },
  ],
  
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    files: true,
    feeds: true,            // Enable social feed, comments, and mentions
    activities: true,       // Enable tasks and events tracking
    trash: true,
    mru: true,              // Track Most Recently Used
  },
  
  titleFormat: '{full_name} - {company}',
  compactLayout: ['full_name', 'company', 'email', 'status', 'owner'],
  
  // Removed: list_views and form_views belong in UI configuration, not object definition
  
  validations: [
    {
      name: 'email_required',
      type: 'script',
      severity: 'error',
      message: 'Email is required',
      condition: 'ISBLANK(email)',
    },
    {
      name: 'cannot_edit_converted',
      type: 'script',
      severity: 'error',
      message: 'Cannot edit a converted lead',
      condition: 'is_converted = true AND ISCHANGED(company, email, first_name, last_name)',
    },
  ],
  
  workflows: [
    {
      name: 'auto_qualify_high_score_leads',
      objectName: 'lead',
      triggerType: 'on_create_or_update',
      criteria: 'rating >= 4 AND status = "new"',
      active: true,
      actions: [
        {
          name: 'set_status',
          type: 'field_update',
          field: 'status',
          value: 'contacted',
        }
      ],
    },
    {
      name: 'notify_owner_on_high_score_lead',
      objectName: 'lead',
      triggerType: 'on_create_or_update',
      criteria: 'ISCHANGED(rating) AND rating >= 4.5',
      active: true,
      actions: [
        {
          name: 'email_owner',
          type: 'email_alert',
          template: 'high_score_lead_notification',
          recipients: ['{owner.email}'],
        }
      ],
    }
  ],
});
