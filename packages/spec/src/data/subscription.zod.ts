// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Subscription Event Type
 * Event types that can be subscribed to for record-level notifications.
 */
import { lazySchema } from '../shared/lazy-schema';
export const SubscriptionEventType = z.enum([
  'comment',
  'mention',
  'field_change',
  'task',
  'approval',
  'all',
]);
export type SubscriptionEventType = z.infer<typeof SubscriptionEventType>;

/**
 * Notification Channel
 * Delivery channels for record subscription notifications.
 */
export const NotificationChannel = z.enum([
  'in_app',
  'email',
  'push',
  'slack',
]);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

/**
 * Record Subscription Schema
 * Defines a user's subscription to record-level notifications.
 * Enables Airtable-style bell icon for record change notifications.
 */
export const RecordSubscriptionSchema = lazySchema(() => z.object({
  /** Target */
  object: z.string().describe('Object name'),
  recordId: z.string().describe('Record ID'),

  /** Subscriber */
  userId: z.string().describe('Subscribing user ID'),

  /** Events to subscribe to */
  events: z.array(SubscriptionEventType)
    .default(['all'])
    .describe('Event types to receive notifications for'),

  /** Notification channels */
  channels: z.array(NotificationChannel)
    .default(['in_app'])
    .describe('Notification delivery channels'),

  /** Active */
  active: z.boolean().default(true).describe('Whether the subscription is active'),

  /** Timestamps */
  createdAt: z.string().datetime().describe('Subscription creation timestamp'),
}));
export type RecordSubscription = z.infer<typeof RecordSubscriptionSchema>;
