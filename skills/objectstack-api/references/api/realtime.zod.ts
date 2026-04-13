// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { RealtimeRecordAction, BasePresenceSchema } from './realtime-shared.zod';

// Re-export shared types for backward compatibility
export { PresenceStatus, RealtimeRecordAction, BasePresenceSchema } from './realtime-shared.zod';
export type { BasePresence } from './realtime-shared.zod';

/**
 * Transport Protocol Enum
 * Defines the communication protocol for realtime data synchronization
 */
export const TransportProtocol = z.enum([
  'websocket',  // Full-duplex, low latency communication
  'sse',        // Server-Sent Events, unidirectional push
  'polling',    // Short polling, best compatibility
]);

export type TransportProtocol = z.infer<typeof TransportProtocol>;

/**
 * Event Type Enum
 * Types of realtime events that can be subscribed to
 */
export const RealtimeEventType = z.enum([
  'record.created',
  'record.updated',
  'record.deleted',
  'field.changed',
]);

export type RealtimeEventType = z.infer<typeof RealtimeEventType>;

/**
 * Subscription Event Configuration
 * Defines what events to subscribe to with optional filtering
 */
export const SubscriptionEventSchema = z.object({
  type: RealtimeEventType.describe('Type of event to subscribe to'),
  object: z.string().optional().describe('Object name to subscribe to'),
  filters: z.unknown().optional().describe('Filter conditions'),
});

/**
 * Subscription Schema
 * Configuration for subscribing to realtime events
 */
export const SubscriptionSchema = z.object({
  id: z.string().uuid().describe('Unique subscription identifier'),
  events: z.array(SubscriptionEventSchema).describe('Array of events to subscribe to'),
  transport: TransportProtocol.describe('Transport protocol to use'),
  channel: z.string().optional().describe('Optional channel name for grouping subscriptions'),
});

export type Subscription = z.infer<typeof SubscriptionSchema>;

/**
 * Presence Schema
 * Tracks user online status and metadata.
 * Extends the shared BasePresenceSchema for transport-level presence tracking.
 */
export const RealtimePresenceSchema = BasePresenceSchema;

export type RealtimePresence = z.infer<typeof RealtimePresenceSchema>;

/**
 * Realtime Event Schema
 * Represents a realtime synchronization event
 */
export const RealtimeEventSchema = z.object({
  id: z.string().uuid().describe('Unique event identifier'),
  type: z.string().describe('Event type (e.g., record.created, record.updated)'),
  object: z.string().optional().describe('Object name the event relates to'),
  action: RealtimeRecordAction.optional().describe('Action performed'),
  payload: z.record(z.string(), z.unknown()).describe('Event payload data'),
  timestamp: z.string().datetime().describe('ISO 8601 datetime when event occurred'),
  userId: z.string().optional().describe('User who triggered the event'),
  sessionId: z.string().optional().describe('Session identifier'),
});

export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>;

/**
 * Realtime Configuration Schema
 * 
 * Configuration for enabling realtime data synchronization.
 */
export const RealtimeConfigSchema = z.object({
  /** Enable realtime sync */
  enabled: z.boolean().default(true).describe('Enable realtime synchronization'),
  
  /** Transport protocol */
  transport: TransportProtocol.default('websocket').describe('Transport protocol'),
  
  /** Default subscriptions */
  subscriptions: z.array(SubscriptionSchema).optional().describe('Default subscriptions'),
}).passthrough(); // Allow additional properties

export type RealtimeConfig = z.infer<typeof RealtimeConfigSchema>;
