// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineCube } from '@objectstack/spec/data';

/**
 * Opportunity Pipeline Cube — revenue metrics broken down by stage,
 * owner, and account for the CRM sales dashboard.
 */
export const PipelineCube = defineCube({
  name: 'crm_pipeline',
  title: 'CRM Pipeline',
  description: 'Revenue and deal-count analytics across the sales pipeline.',
  sql: 'crm_opportunity',
  measures: {
    count: {
      name: 'count',
      label: 'Deal Count',
      type: 'count',
      sql: '*',
    },
    total_amount: {
      name: 'total_amount',
      label: 'Total Pipeline Value',
      type: 'sum',
      sql: 'amount',
      format: 'currency',
    },
    avg_amount: {
      name: 'avg_amount',
      label: 'Average Deal Size',
      type: 'avg',
      sql: 'amount',
      format: 'currency',
    },
    win_rate: {
      name: 'win_rate',
      label: 'Win Rate (%)',
      type: 'number',
      sql: "SUM(CASE WHEN stage = 'closed_won' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)",
      format: 'percent',
    },
  },
  dimensions: {
    stage: {
      name: 'stage',
      label: 'Pipeline Stage',
      type: 'string',
      sql: 'stage',
    },
    close_date: {
      name: 'close_date',
      label: 'Close Date',
      type: 'time',
      sql: 'close_date',
    },
    owner: {
      name: 'owner',
      label: 'Owner',
      type: 'string',
      sql: 'owner_id',
    },
  },
  joins: {
    crm_account: {
      name: 'crm_account',
      relationship: 'many_to_one',
      sql: '${crm_pipeline}.account_id = ${crm_account}.id',
    },
  },
  refreshKey: {
    every: '1 hour',
  },
  public: false,
});

/**
 * Lead funnel cube — conversion metrics from lead to opportunity.
 */
export const LeadFunnelCube = defineCube({
  name: 'crm_lead_funnel',
  title: 'CRM Lead Funnel',
  description: 'Lead volume and conversion rate analytics.',
  sql: 'crm_lead',
  measures: {
    count: {
      name: 'count',
      label: 'Lead Count',
      type: 'count',
      sql: '*',
    },
    converted_count: {
      name: 'converted_count',
      label: 'Converted Leads',
      type: 'count',
      sql: 'converted_opportunity_id',
    },
  },
  dimensions: {
    status: {
      name: 'status',
      label: 'Lead Status',
      type: 'string',
      sql: 'status',
    },
    source: {
      name: 'source',
      label: 'Lead Source',
      type: 'string',
      sql: 'source',
    },
    created_at: {
      name: 'created_at',
      label: 'Created At',
      type: 'time',
      sql: 'created_at',
    },
  },
  refreshKey: {
    every: '30 minutes',
  },
  public: false,
});
