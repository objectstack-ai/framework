// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Cube } from '@objectstack/spec/data';

/**
 * Analytic cubes powering the Executive Overview dashboard.
 *
 * Each cube's `sql` field is the underlying ObjectStack object name (the
 * ObjectQLStrategy uses `cube.sql.trim()` as the object to aggregate over).
 */

export const opportunityCube: Cube = {
  name: 'opportunity',
  title: 'Opportunities',
  sql: 'opportunity',
  public: true,
  measures: {
    count:  { name: 'count',  label: 'Count',           type: 'count', sql: '*' },
    amount: { name: 'amount', label: 'Total Amount',    type: 'sum',   sql: 'amount', format: 'currency' },
  },
  dimensions: {
    stage:               { name: 'stage',               label: 'Stage',          type: 'string', sql: 'stage' },
    close_date:          { name: 'close_date',          label: 'Close Date',     type: 'time',   sql: 'close_date',  granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    'account_industry':  { name: 'account_industry',    label: 'Industry',       type: 'string', sql: 'account.industry' },
    owner:               { name: 'owner',               label: 'Owner',          type: 'string', sql: 'owner' },
  },
};

export const accountCube: Cube = {
  name: 'account',
  title: 'Accounts',
  sql: 'account',
  public: true,
  measures: {
    count: { name: 'count', label: 'Count', type: 'count', sql: '*' },
  },
  dimensions: {
    name:           { name: 'name',           label: 'Name',           type: 'string',  sql: 'name' },
    industry:       { name: 'industry',       label: 'Industry',       type: 'string',  sql: 'industry' },
    type:           { name: 'type',           label: 'Type',           type: 'string',  sql: 'type' },
    owner:          { name: 'owner',          label: 'Owner',          type: 'string',  sql: 'owner' },
    is_active:      { name: 'is_active',      label: 'Active',         type: 'boolean', sql: 'is_active' },
    annual_revenue: { name: 'annual_revenue', label: 'Annual Revenue', type: 'number',  sql: 'annual_revenue' },
    created_at:     { name: 'created_at',     label: 'Created Date',   type: 'time',    sql: 'created_at', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
  },
};

export const contactCube: Cube = {
  name: 'contact',
  title: 'Contacts',
  sql: 'contact',
  public: true,
  measures: {
    count: { name: 'count', label: 'Count', type: 'count', sql: '*' },
  },
  dimensions: {},
};

export const leadCube: Cube = {
  name: 'lead',
  title: 'Leads',
  sql: 'lead',
  public: true,
  measures: {
    count: { name: 'count', label: 'Count', type: 'count', sql: '*' },
  },
  dimensions: {
    is_converted: { name: 'is_converted', label: 'Converted', type: 'boolean', sql: 'is_converted' },
  },
};
