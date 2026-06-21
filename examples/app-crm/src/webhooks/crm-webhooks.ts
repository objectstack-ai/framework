// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineWebhook } from '@objectstack/spec/automation';

/**
 * Notify external CRM bus whenever an opportunity is created or updated.
 */
export const OpportunityChangedWebhook = defineWebhook({
  name: 'crm_opportunity_changed',
  label: 'Opportunity Created / Updated',
  object: 'crm_opportunity',
  triggers: ['create', 'update'],
  url: 'https://hooks.example.com/crm/opportunity',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Source': 'objectstack-crm',
  },
  payloadFields: ['id', 'name', 'stage', 'amount', 'owner_id', 'updated_at'],
  authentication: {
    type: 'bearer',
    credentials: { token: 'env:CRM_WEBHOOK_TOKEN' },
  },
  retryPolicy: {
    maxRetries: 3,
    backoffStrategy: 'exponential',
    initialDelayMs: 1000,
    maxDelayMs: 30000,
  },
  timeoutMs: 10000,
  secret: 'env:CRM_WEBHOOK_SECRET',
  isActive: true,
  description: 'Fires on every opportunity create/update for downstream sync.',
  tags: ['crm', 'sync'],
});

/**
 * Notify Slack channel when a deal is won.
 */
export const DealWonSlackWebhook = defineWebhook({
  name: 'crm_deal_won_slack',
  label: 'Deal Won → Slack',
  object: 'crm_opportunity',
  triggers: ['update'],
  url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  payloadFields: ['id', 'name', 'amount', 'owner_id', 'close_date'],
  isActive: true,
  description: 'Posts to #wins Slack channel when stage=closed_won.',
  tags: ['slack', 'notifications'],
});
