// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Plugin Lifecycle Events Protocol
 * 
 * Zod schemas for plugin lifecycle event data structures.
 * These schemas align with the IPluginLifecycleEvents contract interface.
 * 
 * Following ObjectStack "Zod First" principle - all data structures
 * must have Zod schemas for runtime validation and JSON Schema generation.
 */

// ============================================================================
// Event Payload Schemas
// ============================================================================

/**
 * Event Phase Enum
 * Lifecycle phase where an error occurred
 */
export const EventPhaseSchema = z.enum(['init', 'start', 'destroy'])
  .describe('Plugin lifecycle phase');

export type EventPhase = z.infer<typeof EventPhaseSchema>;

/**
 * Plugin Event Base Schema
 * Common fields for all plugin events
 */
export const PluginEventBaseSchema = z.object({
  /**
   * Plugin name
   */
  pluginName: z.string().describe('Name of the plugin'),
  
  /**
   * Event timestamp (Unix milliseconds)
   */
  timestamp: z.number().int().describe('Unix timestamp in milliseconds when event occurred'),
});

/**
 * Plugin Registered Event Schema
 * 
 * @example
 * {
 *   "pluginName": "crm-plugin",
 *   "timestamp": 1706659200000,
 *   "version": "1.0.0"
 * }
 */
export const PluginRegisteredEventSchema = PluginEventBaseSchema.extend({
  /**
   * Plugin version (optional)
   */
  version: z.string().optional().describe('Plugin version'),
});

export type PluginRegisteredEvent = z.infer<typeof PluginRegisteredEventSchema>;

/**
 * Plugin Lifecycle Phase Event Schema
 * For init, start, destroy phases
 * 
 * @example
 * {
 *   "pluginName": "crm-plugin",
 *   "timestamp": 1706659200000,
 *   "duration": 1250,
 *   "phase": "init"
 * }
 */
export const PluginLifecyclePhaseEventSchema = PluginEventBaseSchema.extend({
  /**
   * Duration of the phase (milliseconds)
   */
  duration: z.number().min(0).optional().describe('Duration of the lifecycle phase in milliseconds'),
  
  /**
   * Lifecycle phase
   */
  phase: EventPhaseSchema.optional().describe('Lifecycle phase'),
});

export type PluginLifecyclePhaseEvent = z.infer<typeof PluginLifecyclePhaseEventSchema>;

/**
 * Plugin Error Event Schema
 * When a plugin encounters an error
 * 
 * @example
 * {
 *   "pluginName": "crm-plugin",
 *   "timestamp": 1706659200000,
 *   "error": Error("Connection failed"),
 *   "phase": "start",
 *   "errorMessage": "Connection failed",
 *   "errorStack": "Error: Connection failed\n  at ..."
 * }
 */
export const PluginErrorEventSchema = PluginEventBaseSchema.extend({
  /**
   * Error object
   */
  error: z.object({
    name: z.string().describe('Error class name'),
    message: z.string().describe('Error message'),
    stack: z.string().optional().describe('Stack trace'),
    code: z.string().optional().describe('Error code'),
  }).describe('Serializable error representation'),
  
  /**
   * Lifecycle phase where error occurred
   */
  phase: EventPhaseSchema.describe('Lifecycle phase where error occurred'),
  
  /**
   * Error message (for serialization)
   */
  errorMessage: z.string().optional().describe('Error message'),
  
  /**
   * Error stack trace (for debugging)
   */
  errorStack: z.string().optional().describe('Error stack trace'),
});

export type PluginErrorEvent = z.infer<typeof PluginErrorEventSchema>;

// ============================================================================
// Service Event Schemas
// ============================================================================

/**
 * Service Registered Event Schema
 * 
 * @example
 * {
 *   "serviceName": "database",
 *   "timestamp": 1706659200000,
 *   "serviceType": "IDataEngine"
 * }
 */
export const ServiceRegisteredEventSchema = z.object({
  /**
   * Service name
   */
  serviceName: z.string().describe('Name of the registered service'),
  
  /**
   * Event timestamp (Unix milliseconds)
   */
  timestamp: z.number().int().describe('Unix timestamp in milliseconds'),
  
  /**
   * Service type (optional)
   */
  serviceType: z.string().optional().describe('Type or interface name of the service'),
});

export type ServiceRegisteredEvent = z.infer<typeof ServiceRegisteredEventSchema>;

/**
 * Service Unregistered Event Schema
 * 
 * @example
 * {
 *   "serviceName": "database",
 *   "timestamp": 1706659200000
 * }
 */
export const ServiceUnregisteredEventSchema = z.object({
  /**
   * Service name
   */
  serviceName: z.string().describe('Name of the unregistered service'),
  
  /**
   * Event timestamp (Unix milliseconds)
   */
  timestamp: z.number().int().describe('Unix timestamp in milliseconds'),
});

export type ServiceUnregisteredEvent = z.infer<typeof ServiceUnregisteredEventSchema>;

// ============================================================================
// Hook Event Schemas
// ============================================================================

/**
 * Hook Registered Event Schema
 * 
 * @example
 * {
 *   "hookName": "data.beforeInsert",
 *   "timestamp": 1706659200000,
 *   "handlerCount": 3
 * }
 */
export const HookRegisteredEventSchema = z.object({
  /**
   * Hook name
   */
  hookName: z.string().describe('Name of the hook'),
  
  /**
   * Event timestamp (Unix milliseconds)
   */
  timestamp: z.number().int().describe('Unix timestamp in milliseconds'),
  
  /**
   * Number of handlers registered for this hook
   */
  handlerCount: z.number().int().min(0).describe('Number of handlers registered for this hook'),
});

export type HookRegisteredEvent = z.infer<typeof HookRegisteredEventSchema>;

/**
 * Hook Triggered Event Schema
 * 
 * @example
 * {
 *   "hookName": "data.beforeInsert",
 *   "timestamp": 1706659200000,
 *   "args": [{ "object": "customer", "data": {...} }],
 *   "handlerCount": 3
 * }
 */
export const HookTriggeredEventSchema = z.object({
  /**
   * Hook name
   */
  hookName: z.string().describe('Name of the hook'),
  
  /**
   * Event timestamp (Unix milliseconds)
   */
  timestamp: z.number().int().describe('Unix timestamp in milliseconds'),
  
  /**
   * Arguments passed to the hook
   */
  args: z.array(z.unknown()).describe('Arguments passed to the hook handlers'),
  
  /**
   * Number of handlers that will handle this event
   */
  handlerCount: z.number().int().min(0).optional().describe('Number of handlers that will handle this event'),
});

export type HookTriggeredEvent = z.infer<typeof HookTriggeredEventSchema>;

// ============================================================================
// Kernel Event Schemas
// ============================================================================

/**
 * Kernel Event Base Schema
 * Common fields for kernel events
 */
export const KernelEventBaseSchema = z.object({
  /**
   * Event timestamp (Unix milliseconds)
   */
  timestamp: z.number().int().describe('Unix timestamp in milliseconds'),
});

/**
 * Kernel Ready Event Schema
 * 
 * @example
 * {
 *   "timestamp": 1706659200000,
 *   "duration": 5400,
 *   "pluginCount": 12
 * }
 */
export const KernelReadyEventSchema = KernelEventBaseSchema.extend({
  /**
   * Total initialization duration (milliseconds)
   */
  duration: z.number().min(0).optional().describe('Total initialization duration in milliseconds'),
  
  /**
   * Number of plugins initialized
   */
  pluginCount: z.number().int().min(0).optional().describe('Number of plugins initialized'),
});

export type KernelReadyEvent = z.infer<typeof KernelReadyEventSchema>;

/**
 * Kernel Shutdown Event Schema
 * 
 * @example
 * {
 *   "timestamp": 1706659200000,
 *   "reason": "SIGTERM received"
 * }
 */
export const KernelShutdownEventSchema = KernelEventBaseSchema.extend({
  /**
   * Shutdown reason (optional)
   */
  reason: z.string().optional().describe('Reason for kernel shutdown'),
});

export type KernelShutdownEvent = z.infer<typeof KernelShutdownEventSchema>;

// ============================================================================
// Event Type Registry
// ============================================================================

/**
 * Plugin Lifecycle Event Type Enum
 * All possible plugin lifecycle event types
 */
export const PluginLifecycleEventType = z.enum([
  'kernel:ready',
  'kernel:shutdown',
  'kernel:before-init',
  'kernel:after-init',
  'plugin:registered',
  'plugin:before-init',
  'plugin:init',
  'plugin:after-init',
  'plugin:before-start',
  'plugin:started',
  'plugin:after-start',
  'plugin:before-destroy',
  'plugin:destroyed',
  'plugin:after-destroy',
  'plugin:error',
  'service:registered',
  'service:unregistered',
  'hook:registered',
  'hook:triggered',
]).describe('Plugin lifecycle event type');

export type PluginLifecycleEventType = z.infer<typeof PluginLifecycleEventType>;
