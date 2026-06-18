// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Mapping } from '@objectstack/spec/data';

/**
 * CSV import mapping for bulk lead upload.
 * Maps common CRM export column names to crm_lead fields.
 */
export const LeadCsvImportMapping: Mapping = {
  name: 'csv_import_leads',
  label: 'CSV Import: Leads',
  sourceFormat: 'csv',
  targetObject: 'crm_lead',
  mode: 'upsert',
  upsertKey: ['email'],
  fieldMapping: [
    { source: 'First Name', target: 'first_name', transform: 'none' },
    { source: 'Last Name', target: 'last_name', transform: 'none' },
    { source: 'Email', target: 'email', transform: 'none' },
    { source: 'Phone', target: 'phone', transform: 'none' },
    { source: 'Company', target: 'company', transform: 'none' },
    {
      source: 'Lead Status',
      target: 'status',
      transform: 'map',
      params: {
        valueMap: {
          New: 'new',
          'Working': 'contacted',
          Qualified: 'qualified',
          'Unqualified': 'disqualified',
          Converted: 'converted',
        },
      },
    },
    {
      source: 'Lead Source',
      target: 'source',
      transform: 'map',
      params: {
        valueMap: {
          'Web': 'web',
          'Email Campaign': 'email_campaign',
          'Cold Call': 'cold_call',
          'Referral': 'referral',
          'Trade Show': 'trade_show',
        },
      },
    },
    { source: 'Lead Score', target: 'lead_score', transform: 'none' },
  ],
  errorPolicy: 'skip',
  batchSize: 500,
};

/**
 * JSON import mapping for contact sync from external systems (HubSpot, etc.).
 */
export const ContactJsonSyncMapping: Mapping = {
  name: 'json_sync_contacts',
  label: 'JSON Sync: Contacts from HubSpot',
  sourceFormat: 'json',
  targetObject: 'crm_contact',
  mode: 'upsert',
  upsertKey: ['email'],
  fieldMapping: [
    { source: 'properties.firstname', target: 'first_name', transform: 'none' },
    { source: 'properties.lastname', target: 'last_name', transform: 'none' },
    { source: 'properties.email', target: 'email', transform: 'none' },
    { source: 'properties.phone', target: 'phone', transform: 'none' },
    { source: 'properties.jobtitle', target: 'title', transform: 'none' },
  ],
  errorPolicy: 'skip',
  batchSize: 250,
};
