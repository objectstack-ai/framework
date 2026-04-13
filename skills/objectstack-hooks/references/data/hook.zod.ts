// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Hook Lifecycle Events
 * Defines the interception points in the ObjectQL execution pipeline.
 */
export const HookEvent = z.enum([
  // Read Operations
  'beforeFind', 'afterFind',
  'beforeFindOne', 'afterFindOne',
  'beforeCount', 'afterCount',
  'beforeAggregate', 'afterAggregate',

  // Write Operations
  'beforeInsert', 'afterInsert',
  'beforeUpdate', 'afterUpdate',
  'beforeDelete', 'afterDelete',
  
  // Bulk Operations (Query-based)
  'beforeUpdateMany', 'afterUpdateMany',
  'beforeDeleteMany', 'afterDeleteMany',
]);

/**
 * Hook Definition Schema
 * 
 * Hooks serve as the "Logic Layer" in ObjectStack, allowing developers to 
 * inject custom code during the data access lifecycle.
 * 
 * Use cases:
 * - Data Enrichment (Default values, Calculated fields)
 * - Validation (Complex business rules)
 * - Side Effects (Sending emails, Syncing to external systems)
 * - Security (Filtering data based on context)
 */
export const HookSchema = z.object({
  /**
   * Unique identifier for the hook
   * Required for debugging and overriding.
   */
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Hook unique name (snake_case)'),

  /**
   * Human readable label
   */
  label: z.string().optional().describe('Description of what this hook does'),

  /**
   * Target Object(s)
   * can be:
   * - Single object: "account"
   * - List of objects: ["account", "contact"]
   * - Wildcard: "*" (All objects)
   */
  object: z.union([z.string(), z.array(z.string())]).describe('Target object(s)'),

  /**
   * Events to subscribe to
   * Combinations of timing (before/after) and action (find/insert/update/delete/etc)
   */
  events: z.array(HookEvent).describe('Lifecycle events'),

  /**
   * Handler Logic
   * Reference to a registered function in the plugin system OR a direct function (runtime only).
   */
  handler: z.union([z.string(), z.function()]).optional().describe('Handler function name (string) or inline function reference'),

  /**
   * Execution Order
   * Lower numbers run first.
   * - System Hooks: 0-99
   * - App Hooks: 100-999
   * - User Hooks: 1000+
   */
  priority: z.number().default(100).describe('Execution priority'),

  /**
   * Async / Background Execution
   * If true, the hook runs in the background and does not block the transaction.
   * Only applicable for 'after*' events.
   * Default: false (Blocking)
   */
  async: z.boolean().default(false).describe('Run specifically as fire-and-forget'),

  /**
   * Declarative Condition
   * Formula expression evaluated before the handler runs.
   * If provided and evaluates to FALSE, the hook is skipped entirely.
   * Useful for filtering by record data without writing handler code.
   * 
   * @example "status = 'active' AND amount > 1000"
   */
  condition: z.string().optional().describe('Formula expression; hook runs only when TRUE (e.g., "status = \'closed\' AND amount > 1000")'),

  /**
   * Human-readable description
   */
  description: z.string().optional().describe('Human-readable description of what this hook does'),

  /**
   * Retry Policy
   */
  retryPolicy: z.object({
    maxRetries: z.number().default(3).describe('Maximum retry attempts on failure'),
    backoffMs: z.number().default(1000).describe('Backoff delay between retries in milliseconds'),
  }).optional().describe('Retry policy for failed hook executions'),

  /**
   * Execution Timeout
   */
  timeout: z.number().optional().describe('Maximum execution time in milliseconds before the hook is aborted'),

  /**
   * Error Policy
   * What to do if the hook throws an exception?
   * - abort: Rollback transaction (if blocking)
   * - log: Log error and continue
   */
  onError: z.enum(['abort', 'log']).default('abort').describe('Error handling strategy'),
});

/**
 * Hook Runtime Context
 * Defines what is available to the hook handler during execution.
 * 
 * Best Practices:
 * - **Immutability**: `object`, `event`, `id` are immutable.
 * - **Mutability**: `input` and `result` are mutable to allow transformation.
 * - **Encapsulation**: `session` isolates auth info; `transaction` ensures atomicity.
 */
export const HookContextSchema = z.object({
  /** Tracing ID */
  id: z.string().optional().describe('Unique execution ID for tracing'),

  /** Target Object Name */
  object: z.string(),
  
  /** Current Lifecycle Event */
  event: HookEvent,

  /** 
   * Input Parameters (Mutable)
   * Modify this to change the behavior of the operation.
   * 
   * - find: { query: QueryAST, options: DriverOptions }
   * - insert: { doc: Record, options: DriverOptions }
   * - update: { id: ID, doc: Record, options: DriverOptions }
   * - delete: { id: ID, options: DriverOptions }
   * - updateMany: { query: QueryAST, doc: Record, options: DriverOptions }
   * - deleteMany: { query: QueryAST, options: DriverOptions }
   */
  input: z.record(z.string(), z.unknown()).describe('Mutable input parameters'),

  /** 
   * Operation Result (Mutable)
   * Available in 'after*' events. Modify this to transform the output.
   */
  result: z.unknown().optional().describe('Operation result (After hooks only)'),

  /**
   * Data Snapshot
   * The state of the record BEFORE the operation (for update/delete).
   */
  previous: z.record(z.string(), z.unknown()).optional().describe('Record state before operation'),

  /**
   * Execution Session
   * Contains authentication and tenancy information.
   */
  session: z.object({
    userId: z.string().optional(),
    tenantId: z.string().optional(),
    roles: z.array(z.string()).optional(),
    accessToken: z.string().optional(),
  }).optional().describe('Current session context'),
  
  /**
   * Transaction Handle
   * If the operation is part of a transaction, use this handle for side-effects.
   */
  transaction: z.unknown().optional().describe('Database transaction handle'),

  /**
   * Engine Access
   * Reference to the ObjectQL engine for performing side effects.
   */
  ql: z.unknown().describe('ObjectQL Engine Reference'),

  /**
   * Cross-Object API
   * Provides a scoped data access interface for performing CRUD operations
   * on other objects within hooks. Bound to the current execution context
   * (userId, tenantId, transaction).
   *
   * Usage in hooks:
   *   const users = ctx.api.object('user');
   *   const admin = await users.findOne({ filter: { role: 'admin' } });
   */
  api: z.unknown().optional().describe('Cross-object data access (ScopedContext)'),

  /**
   * Current User Info
   * Convenience shortcut for session.userId + additional user metadata.
   * Populated by the engine when available.
   */
  user: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
  }).optional().describe('Current user info shortcut'),
});

export type Hook = z.input<typeof HookSchema>;
export type ResolvedHook = z.output<typeof HookSchema>;
export type HookEventType = z.infer<typeof HookEvent>;
export type HookContext = z.infer<typeof HookContextSchema>;
