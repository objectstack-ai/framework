// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';
import { OpportunityStateMachine } from './opportunity.state';

export const Opportunity = ObjectSchema.create({
  name: 'opportunity',
  label: 'Opportunity',
  pluralLabel: 'Opportunities',
  icon: 'dollar-sign',
  description: 'Sales opportunities and deals in the pipeline',
  titleFormat: '{name} - {stage}',
  compactLayout: ['name', 'account', 'amount', 'stage', 'owner'],
  
  fields: {
    // Basic Information
    name: Field.text({ 
      label: 'Opportunity Name',
      required: true,
      searchable: true,
    }),
    
    // Relationships
    account: Field.lookup('account', { 
      label: 'Account',
      required: true,
    }),
    
    primary_contact: Field.lookup('contact', {
      label: 'Primary Contact',
      referenceFilters: ['account = {opportunity.account}'],  // Filter contacts by account
    }),
    
    owner: Field.lookup('user', {
      label: 'Opportunity Owner',
      required: true,
    }),
    
    // Financial Information
    amount: Field.currency({
      label: 'Amount',
      required: true,
      scale: 2,
      min: 0,
    }),
    
    expected_revenue: Field.currency({
      label: 'Expected Revenue',
      scale: 2,
      readonly: true,  // Calculated field
    }),
    
    // Sales Process
    stage: Field.select({
      label: 'Stage',
      required: true,
      options: [
        { label: 'Prospecting', value: 'prospecting', color: '#808080', default: true },
        { label: 'Qualification', value: 'qualification', color: '#FFA500' },
        { label: 'Needs Analysis', value: 'needs_analysis', color: '#FFD700' },
        { label: 'Proposal', value: 'proposal', color: '#4169E1' },
        { label: 'Negotiation', value: 'negotiation', color: '#9370DB' },
        { label: 'Closed Won', value: 'closed_won', color: '#00AA00' },
        { label: 'Closed Lost', value: 'closed_lost', color: '#FF0000' },
      ]
    }),
    
    probability: Field.percent({
      label: 'Probability (%)',
      min: 0,
      max: 100,
      defaultValue: 10,
    }),
    
    // Important Dates
    close_date: Field.date({
      label: 'Close Date',
      required: true,
    }),
    
    created_date: Field.datetime({
      label: 'Created Date',
      readonly: true,
    }),
    
    // Additional Classification
    type: Field.select({
      label: 'Opportunity Type',
      options: [
        { label: 'New Business', value: 'new_business' },
        { label: 'Existing Customer - Upgrade', value: 'existing_upgrade' },
        { label: 'Existing Customer - Renewal', value: 'existing_renewal' },
        { label: 'Existing Customer - Expansion', value: 'existing_expansion' },
      ]
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
    
    // Competitor Analysis
    competitors: Field.select({
      label: 'Competitors',
      multiple: true,
      options: [
        { label: 'Competitor A', value: 'competitor_a' },
        { label: 'Competitor B', value: 'competitor_b' },
        { label: 'Competitor C', value: 'competitor_c' },
      ]
    }),
    
    // Campaign tracking
    campaign: Field.lookup('campaign', {
      label: 'Campaign',
      description: 'Marketing campaign that generated this opportunity',
    }),
    
    // Sales cycle metrics
    days_in_stage: Field.number({
      label: 'Days in Current Stage',
      readonly: true,
    }),
    
    // Additional information
    description: Field.markdown({
      label: 'Description',
    }),
    
    next_step: Field.textarea({
      label: 'Next Steps',
    }),
    
    // Flags
    is_private: Field.boolean({
      label: 'Private',
      defaultValue: false,
    }),
    
    forecast_category: Field.select({
      label: 'Forecast Category',
      options: [
        { label: 'Pipeline', value: 'pipeline' },
        { label: 'Best Case', value: 'best_case' },
        { label: 'Commit', value: 'commit' },
        { label: 'Omitted', value: 'omitted' },
        { label: 'Closed', value: 'closed' },
      ]
    }),
  },
  
  // Database indexes for performance
  indexes: [
    { fields: ['name'], type: 'btree' },
    { fields: ['account'], type: 'btree' },
    { fields: ['owner'], type: 'btree' },
    { fields: ['stage'], type: 'btree' },
    { fields: ['close_date'], type: 'btree' },
  ],
  
  // Enable advanced features
  enable: {
    trackHistory: true,    // Critical for tracking stage changes
    searchable: true,
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete', 'aggregate', 'search'], // Whitelist allowed API operations
    files: true,           // Attach proposals, contracts
    feeds: true,           // Team collaboration (Chatter-like)
    activities: true,      // Enable tasks and events tracking
    trash: true,
    mru: true,             // Track Most Recently Used
  },
  
  // Removed: list_views and form_views belong in UI configuration, not object definition
  
  // Lifecycle State Machine(s)
  stateMachines: {
    lifecycle: OpportunityStateMachine,
  },
  
  // Validation Rules
  validations: [
    {
      name: 'close_date_future',
      type: 'script',
      severity: 'warning',
      message: 'Close date should not be in the past unless opportunity is closed',
      condition: 'close_date < TODAY() AND stage != "closed_won" AND stage != "closed_lost"',
    },
    {
      name: 'amount_positive',
      type: 'script',
      severity: 'error',
      message: 'Amount must be greater than zero',
      condition: 'amount <= 0',
    },
  ],
  
  // Workflow Rules
  workflows: [
    {
      name: 'update_probability_by_stage',
      objectName: 'opportunity',
      triggerType: 'on_create_or_update',
      criteria: 'ISCHANGED(stage)',
      active: true,
      actions: [
        {
          name: 'set_probability',
          type: 'field_update',
          field: 'probability',
          value: `CASE(stage,
            "prospecting", 10,
            "qualification", 25,
            "needs_analysis", 40,
            "proposal", 60,
            "negotiation", 80,
            "closed_won", 100,
            "closed_lost", 0,
            probability
          )`,
        },
        {
          name: 'set_forecast_category',
          type: 'field_update',
          field: 'forecast_category',
          value: `CASE(stage,
            "prospecting", "pipeline",
            "qualification", "pipeline",
            "needs_analysis", "best_case",
            "proposal", "commit",
            "negotiation", "commit",
            "closed_won", "closed",
            "closed_lost", "omitted",
            forecast_category
          )`,
        }
      ],
    },
    {
      name: 'calculate_expected_revenue',
      objectName: 'opportunity',
      triggerType: 'on_create_or_update',
      criteria: 'ISCHANGED(amount) OR ISCHANGED(probability)',
      active: true,
      actions: [
        {
          name: 'update_expected_revenue',
          type: 'field_update',
          field: 'expected_revenue',
          value: 'amount * (probability / 100)',
        }
      ],
    },
    {
      name: 'notify_on_large_deal_won',
      objectName: 'opportunity',
      triggerType: 'on_update',
      criteria: 'ISCHANGED(stage) AND stage = "closed_won" AND amount > 100000',
      active: true,
      actions: [
        {
          name: 'notify_management',
          type: 'email_alert',
          template: 'large_deal_won',
          recipients: ['sales_management@example.com'],
        }
      ],
    }
  ],
});