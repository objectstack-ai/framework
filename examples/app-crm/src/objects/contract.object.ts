// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * Contract Object
 * Represents legal contracts with customers
 */
export const Contract = ObjectSchema.create({
  name: 'contract',
  label: 'Contract',
  pluralLabel: 'Contracts',
  icon: 'file-signature',
  description: 'Legal contracts and agreements',
  titleFormat: '{contract_number} - {account.name}',
  compactLayout: ['contract_number', 'account', 'status', 'start_date', 'end_date'],
  
  fields: {
    // AutoNumber field
    contract_number: Field.autonumber({
      label: 'Contract Number',
      format: 'CTR-{0000}',
    }),
    
    // Relationships
    account: Field.lookup('account', {
      label: 'Account',
      required: true,
    }),
    
    contact: Field.lookup('contact', {
      label: 'Primary Contact',
      required: true,
      referenceFilters: [
        'account = {account}',
      ]
    }),
    
    opportunity: Field.lookup('opportunity', {
      label: 'Related Opportunity',
      referenceFilters: [
        'account = {account}',
      ]
    }),
    
    owner: Field.lookup('user', {
      label: 'Contract Owner',
      required: true,
    }),
    
    // Status
    status: Field.select({
      label: 'Status',
      options: [
        { label: 'Draft', value: 'draft', color: '#999999', default: true },
        { label: 'In Approval', value: 'in_approval', color: '#FFA500' },
        { label: 'Activated', value: 'activated', color: '#00AA00' },
        { label: 'Expired', value: 'expired', color: '#FF0000' },
        { label: 'Terminated', value: 'terminated', color: '#666666' },
      ],
      required: true,
    }),
    
    // Contract Terms
    contract_term_months: Field.number({
      label: 'Contract Term (Months)',
      required: true,
      min: 1,
    }),
    
    start_date: Field.date({
      label: 'Start Date',
      required: true,
    }),
    
    end_date: Field.date({
      label: 'End Date',
      required: true,
    }),
    
    // Financial
    contract_value: Field.currency({ 
      label: 'Contract Value',
      scale: 2,
      min: 0,
      required: true,
    }),
    
    billing_frequency: Field.select({
      label: 'Billing Frequency',
      options: [
        { label: 'Monthly', value: 'monthly', default: true },
        { label: 'Quarterly', value: 'quarterly' },
        { label: 'Annually', value: 'annually' },
        { label: 'One-time', value: 'one_time' },
      ]
    }),
    
    payment_terms: Field.select({
      label: 'Payment Terms',
      options: [
        { label: 'Net 15', value: 'net_15' },
        { label: 'Net 30', value: 'net_30', default: true },
        { label: 'Net 60', value: 'net_60' },
        { label: 'Net 90', value: 'net_90' },
      ]
    }),
    
    // Renewal
    auto_renewal: Field.boolean({
      label: 'Auto Renewal',
      defaultValue: false,
    }),
    
    renewal_notice_days: Field.number({
      label: 'Renewal Notice (Days)',
      min: 0,
      defaultValue: 30,
    }),
    
    // Legal
    contract_type: Field.select({
      label: 'Contract Type',
      options: [
        { label: 'Subscription', value: 'subscription' },
        { label: 'Service Agreement', value: 'service' },
        { label: 'License', value: 'license' },
        { label: 'Partnership', value: 'partnership' },
        { label: 'NDA', value: 'nda' },
        { label: 'MSA', value: 'msa' },
      ]
    }),
    
    signed_date: Field.date({
      label: 'Signed Date',
    }),
    
    signed_by: Field.text({
      label: 'Signed By',
      maxLength: 255,
    }),
    
    document_url: Field.url({
      label: 'Contract Document',
    }),
    
    // Terms & Conditions
    special_terms: Field.markdown({
      label: 'Special Terms',
    }),
    
    description: Field.markdown({
      label: 'Description',
    }),
    
    // Billing Address
    billing_address: Field.address({
      label: 'Billing Address',
      addressFormat: 'international',
    }),
  },
  
  // Database indexes
  indexes: [
    { fields: ['account'], type: 'btree' },
    { fields: ['status'], type: 'btree' },
    { fields: ['start_date'], type: 'btree' },
    { fields: ['end_date'], type: 'btree' },
    { fields: ['owner'], type: 'btree' },
  ],
  
  // Enable advanced features
  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete', 'search', 'export'],
    files: true,
    feeds: true,
    activities: true,
    trash: true,
    mru: true,
  },
  
  // Validation Rules
  validations: [
    {
      name: 'end_after_start',
      type: 'script',
      severity: 'error',
      message: 'End Date must be after Start Date',
      condition: 'end_date <= start_date',
    },
    {
      name: 'valid_contract_term',
      type: 'script',
      severity: 'error',
      message: 'Contract Term must match date range',
      condition: 'MONTH_DIFF(end_date, start_date) != contract_term_months',
    },
  ],
  
  // Workflow Rules
  workflows: [
    {
      name: 'contract_expiration_check',
      objectName: 'contract',
      triggerType: 'scheduled',
      schedule: '0 0 * * *', // Daily at midnight
      criteria: 'end_date <= TODAY() AND status = "activated"',
      actions: [
        {
          name: 'mark_expired',
          type: 'field_update',
          field: 'status',
          value: '"expired"',
        },
        {
          name: 'notify_owner',
          type: 'email_alert',
          template: 'contract_expired',
          recipients: ['{owner}'],
        }
      ],
      active: true,
    },
    {
      name: 'renewal_reminder',
      objectName: 'contract',
      triggerType: 'scheduled',
      schedule: '0 0 * * *', // Daily at midnight
      criteria: 'DAYS_UNTIL(end_date) <= renewal_notice_days AND status = "activated"',
      actions: [
        {
          name: 'notify_renewal',
          type: 'email_alert',
          template: 'contract_renewal_reminder',
          recipients: ['{owner}', '{account.owner}'],
        }
      ],
      active: true,
    }
  ],
});
