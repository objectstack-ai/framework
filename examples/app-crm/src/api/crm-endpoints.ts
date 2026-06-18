// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ApiEndpoint } from '@objectstack/spec/api';

/**
 * Custom REST endpoint — exposes pipeline summary metrics.
 * Backed by a flow (lead_qualification_conversion) that aggregates stage data.
 */
export const PipelineSummaryEndpoint: ApiEndpoint = {
  name: 'crm_pipeline_summary',
  path: '/api/v1/crm/pipeline-summary',
  method: 'GET',
  summary: 'Pipeline summary by stage',
  description: 'Returns opportunity count and total value grouped by stage.',
  type: 'object_operation',
  target: 'crm_opportunity',
  objectParams: {
    object: 'crm_opportunity',
    operation: 'find',
  },
  authRequired: true,
  cacheTtl: 60,
};

/**
 * Lead conversion endpoint — triggers the qualification flow via HTTP.
 */
export const LeadConvertEndpoint: ApiEndpoint = {
  name: 'crm_lead_convert',
  path: '/api/v1/crm/leads/:id/convert',
  method: 'POST',
  summary: 'Convert a lead to an opportunity',
  type: 'flow',
  target: 'lead_qualification_conversion',
  inputMapping: [
    { source: 'params.id', target: 'leadId' },
    { source: 'body.ownerId', target: 'ownerId' },
  ],
  authRequired: true,
};

/**
 * Public webhook receiver — inbound events from external marketing tools.
 * No auth required (HMAC verified at the webhook layer instead).
 */
export const MarketingWebhookEndpoint: ApiEndpoint = {
  name: 'crm_marketing_webhook',
  path: '/api/v1/crm/marketing/events',
  method: 'POST',
  summary: 'Receive marketing automation events',
  type: 'flow',
  target: 'lead_qualification_conversion',
  authRequired: false,
};
