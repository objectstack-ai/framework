// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import type { AutomationContext } from '@objectstack/spec/contracts';

/**
 * The identity envelope a flow's data nodes pass to ObjectQL as `options.context`.
 * A structural subset of the kernel `ExecutionContext` — it always carries the
 * three fields the security middleware keys on (`isSystem`, `roles`,
 * `permissions`) so it is directly assignable to the engine's `context` option,
 * plus the optional `userId`/`tenantId` of the acting user.
 */
export interface RunDataContext {
  /** Elevated, RLS-bypassing system principal (full access) when true. */
  isSystem: boolean;
  /** Acting user id — drives owner/role RLS for `runAs:'user'` runs. */
  userId?: string;
  /** Acting user's role names (RLS parity with a direct REST request). */
  roles: string[];
  /** Acting user's explicit permission-set names. */
  permissions: string[];
  /** Acting user's tenant/org id. */
  tenantId?: string;
}

/**
 * Translate a flow run's {@link AutomationContext} into the ObjectQL `context`
 * its CRUD nodes must pass, honoring `runAs` (ADR-0049 / #1888):
 *
 *  - `runAs:'system'` → `{ isSystem: true }` — the security middleware
 *    short-circuits, so the run reads/writes with full access, bypassing RLS.
 *  - `runAs:'user'` (default) → the triggering user's identity
 *    (`{ userId, roles, permissions, tenantId? }`), so the security middleware
 *    enforces that user's row-level security. The run can never exceed the
 *    triggering user's grants. Empty `roles` falls back to the platform's
 *    baseline permission set, exactly like a fresh member's own REST request.
 *
 * Returns `undefined` when neither elevation nor a user identity applies (e.g. a
 * schedule-triggered `user`-mode run with no user). The CRUD node then omits the
 * `context` and the data engine applies its no-identity default — unchanged from
 * the pre-#1888 behavior for that (identity-less) case.
 *
 * The engine sets {@link AutomationContext.runAs} on the run context at setup;
 * this function is the single place that maps it to an ObjectQL context, shared
 * by every data-touching node so the policy can't drift between node types.
 */
export function resolveRunDataContext(context: AutomationContext | undefined): RunDataContext | undefined {
  if (context?.runAs === 'system') {
    return { isSystem: true, roles: [], permissions: [] };
  }
  if (!context?.userId) return undefined;
  // `context` is now narrowed to a defined AutomationContext with a userId.
  const out: RunDataContext = {
    isSystem: false,
    userId: context.userId,
    roles: Array.isArray(context.roles) ? context.roles : [],
    permissions: Array.isArray(context.permissions) ? context.permissions : [],
  };
  if (context.tenantId) out.tenantId = context.tenantId;
  return out;
}
