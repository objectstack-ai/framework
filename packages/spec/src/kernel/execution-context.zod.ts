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

  /**
   * Stable principal label for AUDIT ATTRIBUTION when the operation is not a
   * real user — e.g. a service token (`svc:<name>`) or an automation. The audit
   * writer records this on `sys_audit_log.actor` so a non-user-authenticated
   * write (the class that left `user_id` null and made the os-790m7q env-delete
   * unattributable) is still attributable. `userId` takes precedence when set;
   * this is the fallback. The runtime/host sets it (e.g. the control plane's
   * service-mode auth) — the framework only defines + records the contract.
   */
  actor: z.string().optional(),

  /**
   * Current user's unique email (resolved from session, falling back to a
   * `sys_user` lookup). Exposed to RLS as `current_user.email` for seedable,
   * human-readable owner scoping. Unique by auth invariant — unlike display
   * `name`, which is intentionally not surfaced to RLS.
   */
  email: z.string().optional(),
  
  /** Current organization/tenant ID (resolved from session.activeOrganizationId) */
  tenantId: z.string().optional(),

  /**
   * Active reference timezone (IANA name, e.g. `America/New_York`), resolved
   * once per request from the `localization` settings (platform default →
   * global → tenant; ADR-0053 Phase 2). When unset, consumers treat it as
   * `UTC` — today's behavior.
   */
  timezone: z.string().optional(),

  /**
   * Active locale (BCP-47, e.g. `en-US`), resolved from the `localization`
   * settings alongside `timezone`. Drives message catalogs and number/date
   * formatting. When unset, consumers treat it as `en-US`.
   */
  locale: z.string().optional(),

  /**
   * Active default currency (ISO 4217, e.g. `USD`, `CNY`), resolved from the
   * `localization` settings alongside `timezone`/`locale`. The tenant-level
   * fallback applied when a currency field/measure omits its own (the
   * `localization.currency` manifest contract). Undefined when no tenant
   * default is configured — consumers then render a plain number.
   */
  currency: z.string().optional(),

  /** User role names (resolved from Member + Role) */
  roles: z.array(z.string()).default([]),
  
  /** Aggregated permission names (resolved from PermissionSet) */
  permissions: z.array(z.string()).default([]),

  /**
   * Aggregated system permissions (union of `PermissionSet.systemPermissions`
   * across the user's resolved permission sets). Used to gate app
   * entry (`AppSchema.requiredPermissions`) and system-level capabilities
   * like `manage_users`, `studio.access`, `setup.access`.
   */
  systemPermissions: z.array(z.string()).optional(),

  /**
   * Aggregated tab/app visibility overrides (merged most-permissive across
   * the user's resolved permission sets: visible > default_on > default_off > hidden).
   * Keyed by app name. A `hidden` value forces an app off the user's
   * authorized list even if `requiredPermissions` would otherwise pass.
   */
  tabPermissions: z.record(z.string(), z.enum(['visible', 'hidden', 'default_on', 'default_off'])).optional(),

  /**
   * IDs of all users in the active organization. Pre-resolved so RLS
   * expressions can scope visibility of identity tables (`sys_user`)
   * via `IN (current_user.org_user_ids)` without needing subquery
   * support in the RLS compiler. Populated by the runtime's
   * resolveExecutionContext from `sys_member`.
   */
  org_user_ids: z.array(z.string()).optional(),

  /**
   * Pre-resolved dynamic-membership arrays for RLS (§7.3.1). The runtime
   * resolves set-membership that would otherwise need a subquery — team
   * members under a manager, accounts in a sales rep's territories,
   * records shared with the user — and stages each set here under a
   * stable key. RLS policies then reference a key via
   * `field IN (current_user.<key>)`, which the compiler resolves against
   * this bag without any subquery support.
   *
   * `org_user_ids` is the one well-known, always-populated membership set
   * and stays a named field for back-compat; everything else lives here.
   * Keys are arbitrary `current_user.*` names; values are id arrays. A
   * missing or empty array makes the referencing policy drop out and
   * (if it was the only policy) fail closed — never fail open.
   *
   * @example { team_member_ids: ['u2', 'u3'], territory_account_ids: ['a7'] }
   */
  rlsMembership: z.record(z.string(), z.array(z.string())).optional(),

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
