// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineConnector } from '@objectstack/spec/integration';

/**
 * HubSpot connector — sync contacts and deals bi-directionally.
 * Uses OAuth2 for authentication; actual credentials come from environment.
 */
export const HubSpotConnector = defineConnector({
  name: 'hubspot_crm',
  label: 'HubSpot CRM',
  type: 'saas',
  description: 'Bi-directional sync of contacts, companies, and deals with HubSpot.',
  icon: 'hubspot',
  authentication: {
    type: 'oauth2',
    authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    clientId: 'env:HUBSPOT_CLIENT_ID',
    clientSecret: 'env:HUBSPOT_CLIENT_SECRET',
    scopes: ['contacts', 'crm.objects.deals.read', 'crm.objects.deals.write'],
  },
  actions: [
    {
      key: 'create_contact',
      label: 'Create Contact',
      description: 'Create a new contact in HubSpot',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          firstname: { type: 'string' },
          lastname: { type: 'string' },
        },
        required: ['email'],
      },
    },
    {
      key: 'update_deal',
      label: 'Update Deal',
      description: 'Update an existing deal in HubSpot',
      inputSchema: {
        type: 'object',
        properties: {
          dealId: { type: 'string' },
          dealstage: { type: 'string' },
          amount: { type: 'number' },
        },
        required: ['dealId'],
      },
    },
  ],
  triggers: [
    {
      key: 'contact_created',
      label: 'Contact Created',
      type: 'webhook',
      description: 'Fires when a contact is created in HubSpot',
    },
    {
      key: 'deal_stage_changed',
      label: 'Deal Stage Changed',
      type: 'polling',
      interval: 300,
      description: 'Polls every 5 minutes for deal stage changes',
    },
  ],
  syncConfig: {
    direction: 'bidirectional',
    schedule: '0 * * * *',
    conflictResolution: 'source_wins',
    batchSize: 500,
  },
  rateLimitConfig: {
    maxRequests: 100,
    windowSeconds: 10,
    strategy: 'sliding_window',
  },
  retryConfig: {
    strategy: 'exponential_backoff',
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
  },
  connectionTimeoutMs: 10000,
  requestTimeoutMs: 30000,
  status: 'inactive',
  enabled: true,
});

/**
 * Slack connector — post notifications to channels.
 */
export const SlackConnector = defineConnector({
  name: 'slack_notifications',
  label: 'Slack',
  type: 'api',
  description: 'Post deal-win and alert notifications to Slack channels.',
  icon: 'slack',
  authentication: {
    type: 'bearer',
    token: 'env:SLACK_BOT_TOKEN',
  },
  actions: [
    {
      key: 'post_message',
      label: 'Post Message',
      description: 'Post a message to a Slack channel',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['channel', 'text'],
      },
    },
  ],
  rateLimitConfig: {
    maxRequests: 50,
    windowSeconds: 60,
    strategy: 'token_bucket',
  },
  status: 'inactive',
  enabled: true,
});
