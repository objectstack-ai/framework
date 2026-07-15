// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Auto-grant `organization_admin` to org owners/admins.
 *
 * For every `sys_member` row whose `role` contains `owner` or `admin`,
 * ensure a `sys_user_permission_set` row exists that links the user to
 * the `organization_admin` permission set scoped to that organization.
 * For members whose role no longer qualifies (demotion or membership
 * removal), revoke the matching scoped grant.
 *
 * Lifecycle hookup (wired from `security-plugin.ts`):
 *
 *   - after `sys_member` insert  → reconcile (user_id, organization_id)
 *   - after `sys_member` update  → reconcile both old and new owner pair
 *   - after `sys_member` delete  → reconcile to revoke
 *   - on  `kernel:ready`          → backfill across every existing member
 *
 * All operations are idempotent and failure-isolated so a missing
 * permission-set row, schema drift, or a stale row never blocks the
 * underlying `sys_member` mutation.
 *
 * **Why this isn't done by the better-auth org plugin directly:**
 * better-auth does not know about ObjectStack permission sets — it
 * only stores membership roles. Translating "owner/admin role on this
 * org" into "owns the `organization_admin` permission set scoped to
 * this org" is platform metadata policy and belongs here, alongside
 * `bootstrapPlatformAdmin` (which does the analogous thing for
 * platform admins).
 *
 * **Anti-escalation:** `organization_admin` itself (declared in
 * `platform-objects/src/security/default-permission-sets.ts`) is
 * deliberately read-only on the global RBAC tables
 * (`sys_permission_set`, `sys_user_permission_set`, `sys_position`, …),
 * so a freshly-granted org admin cannot rebind themselves to
 * `admin_full_access`.
 */

import { ORGANIZATION_ADMIN } from '@objectstack/spec';

const SYSTEM_CTX = { isSystem: true } as const;
// [ADR-0095 D3] Single source of truth for the org-admin capability grant name —
// the same constant the TENANT_ADMIN posture rung derives from.
const PERMISSION_SET_NAME = ORGANIZATION_ADMIN;

interface MaybeLogger {
  info?: (message: string, meta?: Record<string, any>) => void;
  warn?: (message: string, meta?: Record<string, any>) => void;
  debug?: (message: string, meta?: Record<string, any>) => void;
}

function genId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}${rand}`;
}

async function tryFind(ql: any, object: string, where: any, limit = 50): Promise<any[]> {
  try {
    const rows = await ql.find(object, { where, limit }, { context: SYSTEM_CTX });
    return Array.isArray(rows) ? rows : Array.isArray(rows?.records) ? rows.records : [];
  } catch {
    return [];
  }
}

async function tryInsert(ql: any, object: string, data: any): Promise<any | null> {
  try {
    return await ql.insert(object, data, { context: SYSTEM_CTX });
  } catch {
    return null;
  }
}

async function tryDelete(ql: any, object: string, id: string): Promise<boolean> {
  try {
    await ql.delete(object, id, { context: SYSTEM_CTX });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a better-auth `sys_member.role` value into a lower-cased role
 * list. better-auth stores either a single role (`"owner"`) or a
 * comma-separated list (`"owner,admin"`).
 */
function parseRoles(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

function isAdminRole(raw: unknown): boolean {
  const roles = parseRoles(raw);
  return roles.includes('owner') || roles.includes('admin');
}

/**
 * Resolve the `sys_permission_set.id` for `organization_admin`. Cached
 * across calls per ObjectQL instance via a WeakMap so repeated
 * reconciliations do not re-query.
 */
const permissionSetIdCache = new WeakMap<object, string>();

async function resolvePermissionSetId(ql: any): Promise<string | null> {
  const cached = permissionSetIdCache.get(ql);
  if (cached) return cached;
  const rows = await tryFind(ql, 'sys_permission_set', { name: PERMISSION_SET_NAME }, 1);
  const id = rows[0]?.id;
  if (typeof id === 'string' && id.length > 0) {
    permissionSetIdCache.set(ql, id);
    return id;
  }
  return null;
}

/**
 * Ensure (or revoke) the org-scoped `organization_admin` grant for
 * `(userId, orgId)` based on the current `sys_member` rows.
 *
 * - If ANY membership row for the pair carries an owner/admin role,
 *   ensure exactly one `sys_user_permission_set` row exists.
 * - Else, remove every `sys_user_permission_set` row that links the
 *   pair to `organization_admin` (handles demotion and membership
 *   removal symmetrically).
 *
 * Returns a structured report for observability. Never throws.
 */
export async function reconcileOrgAdminGrant(
  ql: any,
  userId: string,
  orgId: string,
  options: { logger?: MaybeLogger } = {},
): Promise<{
  action: 'granted' | 'revoked' | 'noop' | 'skipped';
  reason?: string;
}> {
  const logger = options.logger;
  if (!ql || typeof ql.find !== 'function' || typeof ql.insert !== 'function') {
    return { action: 'skipped', reason: 'objectql_unavailable' };
  }
  if (!userId || !orgId) {
    return { action: 'skipped', reason: 'missing_keys' };
  }

  const permSetId = await resolvePermissionSetId(ql);
  if (!permSetId) {
    // organization_admin permission set isn't seeded yet (boot ordering)
    // — caller can retry later (e.g. via kernel:ready backfill).
    return { action: 'skipped', reason: 'permission_set_missing' };
  }

  // 1. Determine whether the user currently holds an admin-grade role
  //    in this org. Better-auth allows multiple membership rows per
  //    pair under some edge cases (legacy data) — any qualifying row
  //    is enough.
  const memberships = await tryFind(
    ql,
    'sys_member',
    { user_id: userId, organization_id: orgId },
    10,
  );
  const shouldGrant = memberships.some((m: any) => isAdminRole(m?.role));

  // 2. Look at existing grants for this exact pair.
  const existingGrants = await tryFind(
    ql,
    'sys_user_permission_set',
    { user_id: userId, organization_id: orgId, permission_set_id: permSetId },
    5,
  );

  if (shouldGrant) {
    if (existingGrants.length > 0) {
      // Deduplicate stale duplicates if any slipped through.
      for (const extra of existingGrants.slice(1)) {
        if (extra?.id) await tryDelete(ql, 'sys_user_permission_set', String(extra.id));
      }
      return { action: 'noop' };
    }
    const created = await tryInsert(ql, 'sys_user_permission_set', {
      id: genId('ups'),
      user_id: userId,
      permission_set_id: permSetId,
      organization_id: orgId,
      granted_by: null,
    });
    if (created) {
      logger?.info?.('[security] granted organization_admin', { userId, orgId });
      return { action: 'granted' };
    }
    return { action: 'skipped', reason: 'insert_failed' };
  }

  // shouldGrant === false → revoke any pre-existing scoped grant.
  if (existingGrants.length === 0) {
    return { action: 'noop' };
  }
  let removed = 0;
  for (const row of existingGrants) {
    if (row?.id && (await tryDelete(ql, 'sys_user_permission_set', String(row.id)))) {
      removed += 1;
    }
  }
  if (removed > 0) {
    logger?.info?.('[security] revoked organization_admin', { userId, orgId, removed });
    return { action: 'revoked' };
  }
  return { action: 'skipped', reason: 'delete_failed' };
}

/**
 * Reconcile every `(user_id, organization_id)` pair that has at least
 * one `sys_member` row. Used by `kernel:ready` to backfill grants for
 * memberships that pre-date this feature, and as a safety net after
 * the platform admin bootstrap auto-creates the default organization.
 */
export async function backfillOrgAdminGrants(
  ql: any,
  options: { logger?: MaybeLogger; limit?: number } = {},
): Promise<{ scanned: number; granted: number; revoked: number; skipped: number }> {
  const logger = options.logger;
  const limit = options.limit ?? 5000;
  const summary = { scanned: 0, granted: 0, revoked: 0, skipped: 0 };
  if (!ql || typeof ql.find !== 'function') return summary;

  const permSetId = await resolvePermissionSetId(ql);
  if (!permSetId) {
    logger?.debug?.('[security] organization_admin backfill skipped — permission set missing');
    return summary;
  }

  const members = await tryFind(ql, 'sys_member', {}, limit);
  // De-duplicate by (user_id, organization_id) pair — a user with two
  // membership rows (e.g. legacy duplicates) only needs one reconcile.
  const seen = new Set<string>();
  for (const m of members) {
    const userId = String(m?.user_id ?? '');
    const orgId = String(m?.organization_id ?? '');
    if (!userId || !orgId) continue;
    const key = `${userId}|${orgId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    summary.scanned += 1;
    const res = await reconcileOrgAdminGrant(ql, userId, orgId, { logger });
    if (res.action === 'granted') summary.granted += 1;
    else if (res.action === 'revoked') summary.revoked += 1;
    else if (res.action === 'skipped') summary.skipped += 1;
  }

  // Also revoke any organization_admin grant pointing at a (user, org)
  // pair with NO membership row left (orphaned grants from deletes
  // that fired before this hook existed).
  const allGrants = await tryFind(
    ql,
    'sys_user_permission_set',
    { permission_set_id: permSetId },
    limit,
  );
  for (const g of allGrants) {
    const userId = String(g?.user_id ?? '');
    const orgId = String(g?.organization_id ?? '');
    if (!userId || !orgId) continue;
    const key = `${userId}|${orgId}`;
    if (seen.has(key)) continue;
    const res = await reconcileOrgAdminGrant(ql, userId, orgId, { logger });
    if (res.action === 'revoked') summary.revoked += 1;
  }

  logger?.info?.('[security] organization_admin backfill complete', summary);
  return summary;
}

/**
 * Extract (user_id, organization_id) candidate pairs from a
 * `sys_member` ObjectQL middleware context. Returns both the
 * pre-change and post-change pair so callers can reconcile each.
 */
export function extractMemberPairs(opCtx: any): Array<{ userId: string; orgId: string }> {
  const out = new Map<string, { userId: string; orgId: string }>();
  const add = (userId: unknown, orgId: unknown) => {
    if (typeof userId === 'string' && typeof orgId === 'string' && userId && orgId) {
      out.set(`${userId}|${orgId}`, { userId, orgId });
    }
  };
  // Post-write payload — most common case.
  add(opCtx?.result?.user_id, opCtx?.result?.organization_id);
  // Update payloads carry the new values in `data` and the prior row
  // in `before` (driver-dependent). We reconcile BOTH so a member
  // moved from org A to org B (or user changed) is handled.
  add(opCtx?.data?.user_id, opCtx?.data?.organization_id);
  add(opCtx?.before?.user_id, opCtx?.before?.organization_id);
  // For deletes the affected row is sometimes only in `existing`.
  add(opCtx?.existing?.user_id, opCtx?.existing?.organization_id);
  return Array.from(out.values());
}
