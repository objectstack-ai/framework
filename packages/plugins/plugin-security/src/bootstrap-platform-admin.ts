// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * bootstrapPlatformAdmin — first-boot platform admin promotion.
 *
 * Two responsibilities, both idempotent and run on `kernel:ready`:
 *
 *  1. **Seed `sys_permission_set` rows** for each `defaultPermissionSets`
 *     entry (admin_full_access / member_default / viewer_readonly).
 *
 *  2. **Promote the first registered user to platform admin** by
 *     inserting a `sys_user_permission_set` row that points at
 *     `admin_full_access` with `organization_id = NULL` (= cross-tenant).
 *     If a platform admin already exists, this is a no-op forever.
 *
 * The "create a Default Organization for the freshly-promoted admin"
 * behavior moved to `@objectstack/plugin-org-scoping` (see
 * `ensureDefaultOrganization`). Install that plugin to get
 * multi-tenant bootstrap.
 */

import type { PermissionSet } from '@objectstack/spec/security';

interface BootstrapOptions {
  /** Logger from PluginContext. */
  logger?: {
    info: (message: string, meta?: Record<string, any>) => void;
    warn: (message: string, meta?: Record<string, any>) => void;
  };
}

const SYSTEM_CTX = { isSystem: true };

async function tryFind(ql: any, object: string, where: any, limit = 100): Promise<any[]> {
  try {
    const rows = await ql.find(object, { where, limit }, { context: SYSTEM_CTX });
    return Array.isArray(rows) ? rows : [];
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

/**
 * Persist seed permission sets and promote the first registered user to
 * platform admin. Safe to call multiple times.
 */
export async function bootstrapPlatformAdmin(
  ql: any,
  bootstrapPermissionSets: PermissionSet[],
  options: BootstrapOptions = {},
): Promise<{
  seeded: number;
  adminPromoted: boolean;
  reason?: string;
}> {
  const logger = options.logger;
  if (!ql || typeof ql.find !== 'function' || typeof ql.insert !== 'function') {
    return { seeded: 0, adminPromoted: false, reason: 'objectql_unavailable' };
  }

  // 1. Seed permission set rows.
  const seeded: Record<string, string> = {};
  for (const ps of bootstrapPermissionSets) {
    if (!ps.name) continue;
    const existing = await tryFind(ql, 'sys_permission_set', { name: ps.name }, 1);
    if (existing.length > 0 && existing[0].id) {
      seeded[ps.name] = existing[0].id;
      continue;
    }
    const id = genId('ps');
    const created = await tryInsert(ql, 'sys_permission_set', {
      id,
      name: ps.name,
      label: ps.label ?? ps.name,
      description: ps.description ?? null,
      object_permissions: JSON.stringify(ps.objects ?? {}),
      field_permissions: JSON.stringify(ps.fields ?? {}),
      // Persist the remaining permset facets so the runtime resolver
      // (rest-server.ts / resolve-execution-context.ts) can hydrate
      // them back into ExecutionContext.systemPermissions etc. Without
      // these the platform-admin promotion grants the right LINK row
      // but the permission set itself carries no capabilities, so
      // `setup.access` / `studio.access` never reach the app filter
      // and the Setup app is invisible even to admin_full_access.
      system_permissions: JSON.stringify(ps.systemPermissions ?? []),
      row_level_security: JSON.stringify(ps.rowLevelSecurity ?? []),
      tab_permissions: JSON.stringify(ps.tabPermissions ?? {}),
      active: true,
    });
    if (created?.id) seeded[ps.name] = created.id;
    else if (created) seeded[ps.name] = id;
  }

  const seededCount = Object.keys(seeded).length;

  // 2. First-user platform admin promotion.
  const adminPsId = seeded['admin_full_access'];
  if (!adminPsId) {
    return { seeded: seededCount, adminPromoted: false, reason: 'admin_permission_set_missing' };
  }

  const existingAdminLinks = await tryFind(
    ql,
    'sys_user_permission_set',
    { permission_set_id: adminPsId },
    5,
  );
  if (existingAdminLinks.some((r) => !r.organization_id)) {
    return { seeded: seededCount, adminPromoted: false, reason: 'already_have_admin' };
  }

  const allUsers = await tryFind(ql, 'sys_user', {}, 50);
  if (allUsers.length === 0) {
    logger?.info?.('[security] no users yet — first sign-up will be promoted to platform admin');
    return { seeded: seededCount, adminPromoted: false, reason: 'no_users' };
  }
  const sorted = [...allUsers].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });
  const target = sorted[0];

  const inserted = await tryInsert(ql, 'sys_user_permission_set', {
    id: genId('ups'),
    user_id: target.id,
    permission_set_id: adminPsId,
    organization_id: null,
    granted_by: null,
  });
  if (!inserted) {
    logger?.warn?.(`[security] failed to grant admin_full_access to first user ${target.email ?? target.id}`);
    return { seeded: seededCount, adminPromoted: false, reason: 'insert_failed' };
  }
  logger?.info?.(`[security] first user promoted to platform admin: ${target.email ?? target.id}`);

  return { seeded: seededCount, adminPromoted: true };
}
