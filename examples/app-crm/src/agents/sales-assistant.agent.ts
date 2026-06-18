// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineAgent, defineSkill, defineTool } from '@objectstack/spec';

/**
 * Example tool — looks up a CRM contact by email.
 * Demonstrates a minimal Tool definition for the metadata-admin UI.
 */
export const LookupContactTool = defineTool({
  name: 'crm_lookup_contact',
  label: 'Look up Contact',
  description: 'Find a contact in the CRM by email address.',
  parameters: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'Contact email address',
      },
    },
    required: ['email'],
  },
  requiresConfirmation: false,
  active: true,
  builtIn: false,
});

/**
 * Example skill — bundles tools used to manage deals.
 */
export const DealManagementSkill = defineSkill({
  name: 'crm_deal_management',
  label: 'Deal Management',
  description: 'Tools and prompts for working with sales opportunities.',
  tools: ['crm_lookup_contact'],
  active: true,
});

/**
 * Example agent — a sales assistant for the CRM.
 */
export const SalesAssistantAgent = defineAgent({
  name: 'crm_sales_assistant',
  label: 'Sales Assistant',
  role: 'You are a helpful sales operations assistant for a CRM system.',
  instructions:
    'Help sales reps find contacts, update opportunities, and summarise their pipeline. Always be concise and ask before making destructive changes.',
  active: true,
  visibility: 'global',
});
