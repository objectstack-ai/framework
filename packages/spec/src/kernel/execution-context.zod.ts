// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Execution Context Schema
 * 
 * Defines the runtime context that flows from HTTP request → data operations.
 * This is the "identity + environment" envelope that every data operation can carry.
 * 
 * Design:
 * - All fields are optional for backward compatibility
 * - `isSystem` bypasses permission checks (for internal/migration operations)
 * - `transaction` carries the database transaction handle for atomicity
 * - `traceId` enables distributed tracing across microservices
 * 
 * Usage:
 *   engine.find('account', { context: { userId: '...', tenantId: '...' } })
 */
import { lazySchema } from '../shared/lazy-schema';
export const ExecutionContextSchema = lazySchema(() => z.object({
  /** Current user ID (resolved from session) */
  userId: z.string().optional(),
  
  /** Current organization/tenant ID (resolved from session.activeOrganizationId) */
  tenantId: z.string().optional(),
  
  /** User role names (resolved from Member + Role) */
  roles: z.array(z.string()).default([]),
  
  /** Aggregated permission names (resolved from PermissionSet) */
  permissions: z.array(z.string()).default([]),

  /**
   * IDs of all users in the active organization. Pre-resolved so RLS
   * expressions can scope visibility of identity tables (`sys_user`)
   * via `IN (current_user.org_user_ids)` without needing subquery
   * support in the RLS compiler. Populated by the runtime's
   * resolveExecutionContext from `sys_member`.
   */
  org_user_ids: z.array(z.string()).optional(),
  
  /** Whether this is a system-level operation (bypasses permission checks) */
  isSystem: z.boolean().default(false),
  
  /** Raw access token (for external API call pass-through) */
  accessToken: z.string().optional(),
  
  /** Database transaction handle */
  transaction: z.unknown().optional(),
  
  /** Request trace ID (for distributed tracing) */
  traceId: z.string().optional(),
}));

export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;
