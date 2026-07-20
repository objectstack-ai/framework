// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0092 / ADR-0103 — registry-driven managed-object write denies for the
 * default permission sets.
 *
 * The default write-granting permission sets (`organization_admin`,
 * `member_default`, `viewer_readonly`, and the MCP write set) grant CRUD via a
 * `'*'` wildcard, then DENY writes on the better-auth-managed identity tables so
 * mutations must flow through the auth pipeline (ADR-0092). That deny-list was a
 * hand-maintained object-name array (`BETTER_AUTH_MANAGED_OBJECTS` in
 * `default-permission-sets.ts`) — precisely the drift ADR-0092 forbids, and it
 * HAD drifted (the static list missed schemas that later declared
 * `managedBy: 'better-auth'`). This module derives the deny-list from the live
 * registry so the permission layer can never silently disagree with the schemas.
 *
 * ── Reference-sharing contract (why this mutates in place) ──
 * The runtime permission evaluator resolves the default sets from the
 * in-memory `bootstrapPermissionSets` objects, NOT from the seeded
 * `sys_permission_set.object_permissions` DB JSON (a DB-row-only fix would be
 * dead code). Those same `PermissionSet` instances are the ones registered via
 * `manifest.register({ permissions })`, handed to the evaluator fallback, AND
 * serialized into the seed row — the registry stores items by reference. So a
 * single in-place mutation of `set.objects` here, run once at `kernel:ready`
 * before the platform-admin seeder, updates every consumer atomically.
 *
 * ── Why the better-auth bucket is hard-denied, ignoring `userActions` ──
 * `sys_user` declares `userActions: { edit: true }` (it opens name/image edits
 * for the UI and the identity guard's field whitelist), so its resolved CRUD
 * affordance grants `edit`. But a permission-set boolean cannot express a
 * field-level whitelist, so the default sets must still deny `allowEdit` on
 * `sys_user` — the field-level narrowing is the identity write guard's job. We
 * therefore key off the raw `managedBy: 'better-auth'` bucket and deny writes
 * unconditionally, rather than deriving from `resolveCrudAffordances` (which
 * would wrongly widen `sys_user`). This byte-preserves the prior behavior.
 *
 * ── Deliberately NOT covered: engine-owned system / append-only objects ──
 * ADR-0103's engine-owned objects (`sys_audit_log`, `sys_automation_run`, …)
 * are also wildcard-granted in these sets, but we do NOT inject deny entries for
 * them: a per-object entry FULLY OVERRIDES the wildcard (lookup, not merge — see
 * `default-permission-sets.ts`), so injecting `{ allowRead: true, ...writes:false }`
 * would silently drop the wildcard's `viewAllRecords` / `modifyAllRecords` — a
 * read-side narrowing. Their user-context writes are already rejected at the
 * engine by `assertEngineOwnedWriteAllowed` (ADR-0103) and reflected in the
 * `/me/permissions` clamp, so the permission-set layer needs no change for them.
 */

import type { PermissionSet } from '@objectstack/spec/security';
import { MCP_AGENT_PERMISSION_SET_WRITE } from '@objectstack/spec/ai';

/**
 * The write posture forced onto every managed identity table: readable, but no
 * generic create / edit / delete. Same shape as the entries the static
 * `denyWritesOnManagedObjects()` baseline emits (deliberately no
 * `viewAllRecords` / `modifyAllRecords` key).
 */
export const MANAGED_DENY_ENTRY = {
  allowRead: true,
  allowCreate: false,
  allowEdit: false,
  allowDelete: false,
};

/**
 * The default sets whose `'*'` wildcard grants writes and therefore must carry
 * the managed-table denies. Explicit allowlist — `admin_full_access` is
 * deliberately excluded (it keeps its unqualified wildcard so an admin can
 * rescue data directly; the runtime guards are its boundary), as are the MCP
 * read / restricted sets (they grant no writes).
 */
export const MANAGED_DENY_TARGET_SETS: readonly string[] = [
  'organization_admin',
  'member_default',
  'viewer_readonly',
  MCP_AGENT_PERMISSION_SET_WRITE,
];

interface SchemaLike {
  name?: string;
  managedBy?: string;
}

export interface ApplyManagedWriteDeniesResult {
  /** Number of (set, object) deny entries newly injected. */
  applied: number;
  /** Number of (set, object) pairs left untouched because an entry already existed. */
  skippedExisting: number;
}

/**
 * Inject a read-only-write deny entry for every `managedBy: 'better-auth'`
 * object into each target set that lacks an explicit entry for it. In-place and
 * idempotent (never overrides an existing entry — so the static baseline and
 * any deliberate per-object carve-out, e.g. org-admin's RBAC read-only block,
 * are preserved). Returns counts for logging / tests.
 */
export function applyManagedWriteDenies(
  sets: PermissionSet[],
  schemas: SchemaLike[],
): ApplyManagedWriteDeniesResult {
  const managedNames = Array.from(
    new Set(
      (schemas ?? [])
        .filter((s) => s?.managedBy === 'better-auth' && typeof s?.name === 'string')
        .map((s) => s.name as string),
    ),
  ).sort();

  const targets = new Set(MANAGED_DENY_TARGET_SETS);
  let applied = 0;
  let skippedExisting = 0;

  for (const set of sets ?? []) {
    if (!set || !targets.has((set as { name?: string }).name ?? '')) continue;
    const objects = (set as { objects?: Record<string, unknown> }).objects;
    if (!objects || typeof objects !== 'object') continue;
    for (const name of managedNames) {
      if (name in objects) {
        skippedExisting++;
        continue;
      }
      objects[name] = { ...MANAGED_DENY_ENTRY };
      applied++;
    }
  }

  return { applied, skippedExisting };
}
