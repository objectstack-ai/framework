// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/plugin-webhooks
 *
 * Outbound webhook delivery for `data.record.created`,
 * `data.record.updated`, and `data.record.deleted` events. Subscribes to
 * the realtime service, fans events out to one or more configured HTTP
 * sinks, signs each request with HMAC-SHA256, and retries transient
 * failures with exponential backoff.
 */

export { WebhooksPlugin } from './webhooks-plugin.js';
export type {
  WebhooksPluginOptions,
  WebhookSink,
  WebhookDeliveryRecord,
  WebhookDeliveryStatus,
} from './webhooks-plugin.js';
