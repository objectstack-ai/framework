// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ensureDefaultOrganization — multi-tenant bootstrap helper.
 *
 * In multi-tenant deployments the freshly-promoted platform admin
 * (`admin_full_access` granted with `organization_id IS NULL`) needs
 * at least one `sys_organization` to carry an `activeOrganizationId`
 * on their session. Without it, the default `tenant_isolation` RLS
 * policy filters everything to zero rows and the admin sees an empty
 * console even though they have full access.
 *
 * Strategy (idempotent, run on `kernel:ready` and after every
 * `sys_user_permission_set` insert):
 *
 *   1. Find the platform admin (oldest `sys_user_permission_set` row
 *      with `permission_set_id = admin_full_access` and
 *      `organization_id IS NULL`). If none, no-op.
 *   2. If that user already has any `sys_member` row, no-op (they
 *      either created their own org or were invited into one — we
 *      respect that and never auto-create a "Default Organization"
 *      behind their back).
 *   3. Re-use a pre-existing `slug='default'` org if present;
 *      otherwise create one. Stable slug keeps human-readable URLs
 *      predictable across cold-boots.
 *   4. Insert a `sys_member { role: 'owner' }` linking the admin to
 *      the default org.
 *
 * This is the ONLY framework-side auto-provisioning of an org.
 * Subsequent users must accept an invitation or explicitly create
 * their first organization — `claimOrphanOrgRows` / `cloneOrgSeedData`
 * handle the seed-data side for those flows.
 */

import { claimOrgSeedOwnership } from './claim-org-seed-ownership.js';

interface EnsureOptions {
  logger?: {
    info: (message: string, meta?: Record<string, any>) => void;
    warn: (message: string, meta?: Record<string, any>) => void;
  };
}

const SYSTEM_CTX = { isSystem: true };

async function tryFind(ql: any, object: string, where: any, limit = 100): Promise<any[]> {
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

function genId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}${rand}`;
}

export interface EnsureDefaultOrganizationResult {
  /** Whether a brand-new org row was inserted (vs. re-using slug=default). */
  defaultOrgCreated: boolean;
  /** Resolved (or freshly minted) default-org id; undefined when no admin exists yet. */
  defaultOrgId?: string;
  /** Whether a sys_member row was inserted binding the admin to the default org. */
  memberCreated: boolean;
  /** Human-readable reason when the helper short-circuited. */
  reason?: 'no_admin' | 'admin_already_in_org' | 'org_insert_failed' | 'member_insert_failed';
  /** Count of the default org's seeded rows re-owned to the platform admin. */
  ownershipClaimed?: number;
}

/**
 * Ensure the platform admin has a Default Organization to operate in.
 * Safe to call multiple times — idempotent on stable slug `default`
 * and on the presence of any existing `sys_member` row for the admin.
 */
export async function ensureDefaultOrganization(
  ql: any,
  options: EnsureOptions = {},
): Promise<EnsureDefaultOrganizationResult> {
  const logger = options.logger;
  if (!ql || typeof ql.find !== 'function' || typeof ql.insert !== 'function') {
    return { defaultOrgCreated: false, memberCreated: false, reason: 'no_admin' };
  }

  // 1. Find the platform admin permission-set id.
  const adminPs = await tryFind(ql, 'sys_permission_set', { name: 'admin_full_access' }, 1);
  if (adminPs.length === 0 || !adminPs[0].id) {
    return { defaultOrgCreated: false, memberCreated: false, reason: 'no_admin' };
  }
  const adminPsId = adminPs[0].id;

  // 2. Find the platform admin user (oldest cross-tenant grant).
  const adminGrants = await tryFind(
    ql,
    'sys_user_permission_set',
    { permission_set_id: adminPsId, organization_id: null },
    50,
  );
  if (adminGrants.length === 0) {
    return { defaultOrgCreated: false, memberCreated: false, reason: 'no_admin' };
  }
  const sortedGrants = [...adminGrants].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });
  const adminUserId: string | undefined = sortedGrants[0]?.user_id;
  if (!adminUserId) {
    return { defaultOrgCreated: false, memberCreated: false, reason: 'no_admin' };
  }

  // 3. Respect existing membership — never auto-create a default org
  //    behind an admin who already belongs somewhere.
  const memberships = await tryFind(ql, 'sys_member', { user_id: adminUserId }, 1);
  if (memberships.length > 0) {
    return {
      defaultOrgCreated: false,
      memberCreated: false,
      reason: 'admin_already_in_org',
    };
  }

  // 4. Re-use or create the `default` org.
  let defaultOrgId: string | undefined;
  let defaultOrgCreated = false;
  const existingDefault = await tryFind(ql, 'sys_organization', { slug: 'default' }, 1);
  if (existingDefault.length > 0 && existingDefault[0].id) {
    defaultOrgId = String(existingDefault[0].id);
  } else {
    const newOrgId = genId('org');
    const orgRow = await tryInsert(ql, 'sys_organization', {
      id: newOrgId,
      name: 'Default Organization',
      slug: 'default',
      logo: null,
      metadata: null,
    });
    if (!orgRow) {
      logger?.warn?.('[org-scoping] failed to create default organization for platform admin');
      return { defaultOrgCreated: false, memberCreated: false, reason: 'org_insert_failed' };
    }
    defaultOrgId = orgRow?.id ?? newOrgId;
    defaultOrgCreated = true;
  }

  // 5. Bind the admin as owner.
  const memRow = await tryInsert(ql, 'sys_member', {
    id: genId('mem'),
    organization_id: defaultOrgId,
    user_id: adminUserId,
    role: 'owner',
  });
  if (!memRow) {
    logger?.warn?.('[org-scoping] failed to bind platform admin to default organization');
    return {
      defaultOrgCreated,
      defaultOrgId,
      memberCreated: false,
      reason: 'member_insert_failed',
    };
  }
  logger?.info?.(
    `[org-scoping] bound platform admin to default organization (${defaultOrgId})`,
    { userId: adminUserId, defaultOrgId },
  );

  // 6. Hand the default org's seeded rows (owner_id NULL) to the admin so
  //    owner-keyed UX works out of the box — the multi-tenant companion to the
  //    single-tenant first-admin handoff. Best-effort; never undoes the bind.
  let ownershipClaimed = 0;
  if (defaultOrgId) {
    try {
      const claims = await claimOrgSeedOwnership(ql, defaultOrgId, adminUserId, { logger });
      ownershipClaimed = claims.reduce((s, c) => s + c.count, 0);
    } catch (e) {
      logger?.warn?.('[org-scoping] default-org seed ownership handoff failed', {
        error: (e as Error).message,
      });
    }
  }

  return { defaultOrgCreated, defaultOrgId, memberCreated: true, ownershipClaimed };
}
