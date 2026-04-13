// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @module automation/node-executor
 *
 * Node Executor Plugin Protocol — Wait Node Pause/Resume
 *
 * Defines the specification for node executor plugins, with a focus on
 * the `wait` node executor that supports flow pause and external-event
 * resume (signal, manual, webhook, condition).
 *
 * The protocol covers:
 * - **WaitResumePayload**: The payload delivered when a paused flow is resumed
 * - **WaitExecutorConfig**: Configuration for the wait executor plugin
 * - **NodeExecutorDescriptor**: Generic node executor plugin descriptor
 */

import { z } from 'zod';

// ─── Wait Event Types ────────────────────────────────────────────────

/**
 * Wait event type — determines how a wait node is resumed.
 * Mirrors the `waitEventConfig.eventType` in flow.zod.ts.
 */
export const WaitEventTypeSchema = z.enum([
  'timer',      // Resume after duration/datetime
  'signal',     // Resume on named signal dispatch
  'webhook',    // Resume on incoming webhook call
  'manual',     // Resume by manual operator action
  'condition',  // Resume when a data condition is met (polling)
]).describe('Wait event type determining how a paused flow is resumed');

export type WaitEventType = z.infer<typeof WaitEventTypeSchema>;

// ─── Wait Resume Payload ─────────────────────────────────────────────

/**
 * Payload delivered when a paused wait node is resumed by an external event.
 * The runtime engine passes this to the flow executor to continue execution.
 */
export const WaitResumePayloadSchema = z.object({
  /** The execution id of the paused flow */
  executionId: z.string().describe('Execution ID of the paused flow'),

  /** The checkpoint id being resumed */
  checkpointId: z.string().describe('Checkpoint ID to resume from'),

  /** The node id of the wait node being resumed */
  nodeId: z.string().describe('Wait node ID being resumed'),

  /** The event type that triggered the resume */
  eventType: WaitEventTypeSchema.describe('Event type that triggered resume'),

  /** Signal name (for signal events) */
  signalName: z.string().optional().describe('Signal name (when eventType is signal)'),

  /** Webhook payload data (for webhook events) */
  webhookPayload: z.record(z.string(), z.unknown()).optional()
    .describe('Webhook request payload (when eventType is webhook)'),

  /** Who/what triggered the resume */
  resumedBy: z.string().optional().describe('User ID or system identifier that triggered resume'),

  /** Timestamp of the resume event */
  resumedAt: z.string().datetime().describe('ISO 8601 timestamp of the resume event'),

  /** Additional variables to merge into flow context on resume */
  variables: z.record(z.string(), z.unknown()).optional()
    .describe('Variables to merge into flow context upon resume'),
}).describe('Payload for resuming a paused wait node');

export type WaitResumePayload = z.infer<typeof WaitResumePayloadSchema>;

// ─── Wait Executor Config ────────────────────────────────────────────

/**
 * Timeout behavior when a wait node exceeds its timeout.
 */
export const WaitTimeoutBehaviorSchema = z.enum([
  'fail',       // Mark execution as failed
  'continue',   // Continue to next node (skip wait)
  'fallback',   // Execute a fallback edge
]).describe('Behavior when a wait node exceeds its timeout');

export type WaitTimeoutBehavior = z.infer<typeof WaitTimeoutBehaviorSchema>;

/**
 * Configuration for the wait node executor plugin.
 * Controls polling intervals, webhook endpoint patterns, and timeout behavior.
 */
export const WaitExecutorConfigSchema = z.object({
  /** Default timeout for wait nodes without explicit timeout (ms) */
  defaultTimeoutMs: z.number().int().min(0).default(86400000)
    .describe('Default timeout in ms (default: 24 hours)'),

  /** Default timeout behavior */
  defaultTimeoutBehavior: WaitTimeoutBehaviorSchema.default('fail')
    .describe('Default behavior when wait timeout is exceeded'),

  /** Polling interval for condition-based waits (ms) */
  conditionPollIntervalMs: z.number().int().min(1000).default(30000)
    .describe('Polling interval for condition waits in ms (default: 30s)'),

  /** Maximum polling attempts for condition waits (0 = unlimited until timeout) */
  conditionMaxPolls: z.number().int().min(0).default(0)
    .describe('Max polling attempts for condition waits (0 = unlimited)'),

  /** Webhook endpoint URL pattern (runtime fills in execution/node ids) */
  webhookUrlPattern: z.string().default('/api/v1/automation/resume/{executionId}/{nodeId}')
    .describe('URL pattern for webhook resume endpoints'),

  /** Whether to persist checkpoints to durable storage */
  persistCheckpoints: z.boolean().default(true)
    .describe('Persist wait checkpoints to durable storage'),

  /** Maximum concurrent paused executions (0 = unlimited) */
  maxPausedExecutions: z.number().int().min(0).default(0)
    .describe('Max concurrent paused executions (0 = unlimited)'),
}).describe('Wait node executor plugin configuration');

export type WaitExecutorConfig = z.infer<typeof WaitExecutorConfigSchema>;

// ─── Node Executor Descriptor ────────────────────────────────────────

/**
 * Generic node executor plugin descriptor.
 * Each node type (wait, script, http_request, etc.) can register
 * a custom executor via this descriptor.
 */
export const NodeExecutorDescriptorSchema = z.object({
  /** Unique executor identifier */
  id: z.string().describe('Unique executor plugin identifier'),

  /** Human-readable name */
  name: z.string().describe('Display name'),

  /** The FlowNodeAction types this executor handles */
  nodeTypes: z.array(z.string()).min(1)
    .describe('FlowNodeAction types this executor handles'),

  /** Executor plugin version (semver) */
  version: z.string().describe('Plugin version (semver)'),

  /** Description of the executor */
  description: z.string().optional().describe('Executor description'),

  /** Whether this executor supports async pause/resume */
  supportsPause: z.boolean().default(false)
    .describe('Whether the executor supports async pause/resume'),

  /** Whether this executor supports cancellation mid-execution */
  supportsCancellation: z.boolean().default(false)
    .describe('Whether the executor supports mid-execution cancellation'),

  /** Whether this executor supports retry on failure */
  supportsRetry: z.boolean().default(true)
    .describe('Whether the executor supports retry on failure'),

  /** Executor-specific configuration schema (JSON Schema reference) */
  configSchemaRef: z.string().optional()
    .describe('JSON Schema $ref for executor-specific config'),
}).describe('Node executor plugin descriptor');

export type NodeExecutorDescriptor = z.infer<typeof NodeExecutorDescriptorSchema>;

// ─── Built-in Wait Executor Descriptor ───────────────────────────────

/**
 * Built-in descriptor for the wait node executor.
 * Runtime implementations should register this or a compatible executor.
 */
export const WAIT_EXECUTOR_DESCRIPTOR: NodeExecutorDescriptor = {
  id: 'objectstack:wait-executor',
  name: 'Wait Node Executor',
  nodeTypes: ['wait'],
  version: '1.0.0',
  description: 'Pauses flow execution and resumes on timer, signal, webhook, manual action, or condition events.',
  supportsPause: true,
  supportsCancellation: true,
  supportsRetry: true,
};
