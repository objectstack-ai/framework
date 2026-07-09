// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * resolveAuthzContext — the SINGLE source of truth for resolving an inbound
 * request's identity + authorization context (positions, permissions, RLS scoping).
 *
 * Every HTTP entry point (REST server, runtime dispatcher, MCP, any future
 * transport) MUST resolve authorization through this function — never by
 * re-reading `sys_member` / `sys_user_position` / `sys_*_permission_set` itself.
 *
 * Why this exists: authorization resolution used to be DUPLICATED across the
 * REST server (`@objectstack/rest`) and the runtime dispatcher
 * (`@objectstack/runtime`). On a security path, duplicated logic drifts and the
 * drift is silent: the REST copy had quietly omitted `sys_user_position` (so custom
 * roles granted via the ADR-0057 D4 platform-RBAC path didn't apply over REST),
 * `sys_position_permission_set`, `mapMembershipRole` normalization, the
 * platform-admin derivation, and the `ai_seat` synthesis. The API-key half was
 * already shared here (`resolveApiKeyPrincipal`); this completes the extraction
 * by bringing session + role/permission aggregation home too. There is now ONE
 * implementation; both entry points are thin adapters that supply `ql` /
 * `getSession` their own way and delegate here.
 *
 * Fail-closed: every read is defensive. Missing services / tables yield a
 * partial context (even `{ positions: [], permissions: [] }`) — enforcement is the
 * SecurityPlugin's job, never this resolver's.
 */

import {
  mapMembershipRole,
  BUILTIN_IDENTITY_PLATFORM_ADMIN,
  ADMIN_FULL_ACCESS,
} from '@objectstack/spec';

import { resolveApiKeyPrincipal } from './api-key.js';

/** The transport-agnostic authorization envelope produced from a request. */
export interface ResolvedAuthzContext {
  userId?: string;
  tenantId?: string;
  email?: string;
  accessToken?: string;
  positions: string[];
  permissions: string[];
  systemPermissions: string[];
  tabPermissions?: Record<string, 'visible' | 'hidden' | 'default_on' | 'default_off'>;
  /** Fellow-org user IDs for RLS scoping of identity tables (`id IN (...)`). */
  org_user_ids: string[];
}

export interface ResolveAuthzInput {
  /** Data engine (ObjectQL) exposing `find(object, { where, limit, context })`. */
  ql: any;
  /** Inbound request headers (Web `Headers` or a plain record). */
  headers: any;
  /**
   * Resolve a better-auth session from `headers`, returning `{ user?, session? }`
   * (or undefined). Optional — when omitted or throwing, only the API-key path
   * runs and anonymous requests resolve to an empty context.
   */
  getSession?: (headers: any) => Promise<any> | any;
  /** Clock injection for API-key expiry (tests). */
  nowMs?: number;
}

function safeJsonParse<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

async function tryFind(ql: any, object: string, where: any, limit = 100): Promise<any[]> {
  if (!ql || typeof ql.find !== 'function') return [];
  try {
    let rows = await ql.find(object, { where, limit, context: { isSystem: true } } as any);
    if (rows && (rows as any).value) rows = (rows as any).value;
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/**
 * Resolve the authorization context for an inbound request. Always resolves —
 * never throws. Anonymous requests yield `{ positions: [], permissions: [], ... }`.
 */
export async function resolveAuthzContext(input: ResolveAuthzInput): Promise<ResolvedAuthzContext> {
  const { ql, headers } = input;
  const ctx: ResolvedAuthzContext = {
    positions: [],
    permissions: [],
    systemPermissions: [],
    org_user_ids: [],
  };

  let userId: string | undefined;
  let tenantId: string | undefined;

  // 1. API key (explicit opt-in via header) takes precedence over session.
  const keyPrincipal = await resolveApiKeyPrincipal(ql, headers, input.nowMs);
  if (keyPrincipal) {
    userId = keyPrincipal.userId;
    tenantId = keyPrincipal.tenantId;
    for (const scope of keyPrincipal.scopes) {
      if (!ctx.permissions.includes(scope)) ctx.permissions.push(scope);
    }
  }

  // 2. Session / Bearer path — fall back when no API key resolved a user.
  if (!userId && typeof input.getSession === 'function') {
    try {
      const sessionData = await input.getSession(headers);
      userId = sessionData?.user?.id ?? sessionData?.session?.userId;
      tenantId = tenantId ?? sessionData?.session?.activeOrganizationId;
      ctx.accessToken = sessionData?.session?.token ?? ctx.accessToken;
      if (sessionData?.user?.email) ctx.email = String(sessionData.user.email);
    } catch {
      // no auth configured / bad session → anonymous
    }
  }

  if (!userId) return ctx;
  ctx.userId = userId;
  if (tenantId) ctx.tenantId = tenantId;
  if (!ql || typeof ql.find !== 'function') return ctx;

  // sys_user is needed for both the `current_user.email` fallback (API-key auth,
  // where the session didn't supply an email) and the ai_seat synthesis below.
  // Read the row at most once per resolution — the two reads were a duplicate
  // query on the API-key path.
  let userRowLoaded = false;
  let userRow: any;
  const getUserRow = async (): Promise<any> => {
    if (!userRowLoaded) {
      userRowLoaded = true;
      const rows = await tryFind(ql, 'sys_user', { id: userId }, 1);
      userRow = rows[0];
    }
    return userRow;
  };

  // Resolve the caller's unique email for `current_user.email` RLS owner
  // policies when the session path didn't supply it (e.g. API-key auth).
  if (!ctx.email) {
    const u = await getUserRow();
    if (u?.email) ctx.email = String(u.email);
  }

  // 3. Organization-administration roles via sys_member (better-auth), normalized
  //    to the canonical built-in names (owner→org_owner, admin→org_admin, …).
  const memberWhere: any = tenantId
    ? { user_id: userId, organization_id: tenantId }
    : { user_id: userId };
  const members = await tryFind(ql, 'sys_member', memberWhere, 50);
  for (const m of members) {
    if (m.role && typeof m.role === 'string') {
      for (const raw of m.role.split(',').map((s: string) => s.trim()).filter(Boolean)) {
        const r = mapMembershipRole(raw);
        if (!ctx.positions.includes(r)) ctx.positions.push(r);
      }
    }
  }

  // 4. [ADR-0057 D4] Platform-owned RBAC role assignments (sys_user_position) — the
  //    source of truth for custom roles, decoupled from sys_member.role.
  //    `organization_id = null` = global (cross-tenant); else match active org.
  const userPositionRows = await tryFind(ql, 'sys_user_position', { user_id: userId }, 200);
  for (const ur of userPositionRows) {
    const org = ur.organization_id ?? null;
    if (org && tenantId && org !== tenantId) continue;
    const r = ur.position;
    if (typeof r === 'string' && r && !ctx.positions.includes(r)) ctx.positions.push(r);
  }

  // 5. Fellow-org user IDs so RLS can scope identity tables to collaborators.
  if (tenantId) {
    const orgMembers = await tryFind(ql, 'sys_member', { organization_id: tenantId }, 1000);
    const ids = new Set<string>(
      orgMembers
        .map((m) => m.user_id ?? m.userId)
        .filter((v): v is string => typeof v === 'string' && v.length > 0),
    );
    ids.add(userId);
    ctx.org_user_ids = Array.from(ids);
  } else {
    ctx.org_user_ids = [userId];
  }

  // 6. Permission sets — user-scoped grants (null org = global, else active org).
  const upsRows = await tryFind(ql, 'sys_user_permission_set', { user_id: userId }, 100);
  const psIds = new Set<string>(
    upsRows
      .filter((r) => {
        const org = (r.organization_id ?? r.organizationId) ?? null;
        return !(org && tenantId && org !== tenantId);
      })
      .map((r) => r.permission_set_id ?? r.permissionSetId)
      .filter(Boolean),
  );
  // platform_admin (ADR-0068 D2) is DERIVED from an UNSCOPED admin_full_access
  // USER grant — the single source of truth (no trusted stored boolean).
  const unscopedUserPsIds = new Set<string>(
    upsRows
      .filter((r) => ((r.organization_id ?? r.organizationId) ?? null) === null)
      .map((r) => r.permission_set_id ?? r.permissionSetId)
      .filter(Boolean),
  );
  let hasPlatformAdminGrant = false;

  // 6a. Position-bound permission sets (sys_position_permission_set): a position
  //     carries its permission sets.
  if (ctx.positions.length > 0) {
    const positionRows = await tryFind(ql, 'sys_position', { name: { $in: ctx.positions } }, 100);
    const positionIds = positionRows.map((r) => r.id).filter(Boolean);
    if (positionIds.length > 0) {
      const rpsRows = await tryFind(ql, 'sys_position_permission_set', { position_id: { $in: positionIds } }, 500);
      for (const r of rpsRows) {
        const id = r.permission_set_id ?? r.permissionSetId;
        if (id) psIds.add(id);
      }
    }
  }

  // 6b. Resolve permission-set details (names → ctx.permissions; system_permissions;
  //     tab_permissions merged by highest visibility).
  if (psIds.size > 0) {
    const psRows = await tryFind(ql, 'sys_permission_set', { id: { $in: Array.from(psIds) } }, 500);
    const tabRank: Record<string, number> = { hidden: 0, default_off: 1, default_on: 2, visible: 3 };
    const mergedTabs: Record<string, 'visible' | 'hidden' | 'default_on' | 'default_off'> = {};
    for (const ps of psRows) {
      if (ps.name && !ctx.permissions.includes(ps.name)) ctx.permissions.push(ps.name);
      if (ps.name === ADMIN_FULL_ACCESS && unscopedUserPsIds.has(ps.id)) hasPlatformAdminGrant = true;
      const sysPerms = typeof ps.system_permissions === 'string'
        ? safeJsonParse(ps.system_permissions, [])
        : (ps.system_permissions ?? ps.systemPermissions);
      if (Array.isArray(sysPerms)) {
        for (const p of sysPerms) {
          if (typeof p === 'string' && !ctx.systemPermissions.includes(p)) ctx.systemPermissions.push(p);
        }
      }
      const tabs = typeof ps.tab_permissions === 'string'
        ? safeJsonParse(ps.tab_permissions, {})
        : (ps.tab_permissions ?? ps.tabPermissions);
      if (tabs && typeof tabs === 'object') {
        for (const [app, val] of Object.entries(tabs as Record<string, unknown>)) {
          if (typeof val !== 'string' || !(val in tabRank)) continue;
          const cur = mergedTabs[app];
          if (!cur || tabRank[val] > tabRank[cur]) {
            mergedTabs[app] = val as 'visible' | 'hidden' | 'default_on' | 'default_off';
          }
        }
      }
    }
    if (Object.keys(mergedTabs).length > 0) ctx.tabPermissions = mergedTabs;
  }

  // 6c. Project the derived platform_admin built-in role (leads the list).
  if (hasPlatformAdminGrant && !ctx.positions.includes(BUILTIN_IDENTITY_PLATFORM_ADMIN)) {
    ctx.positions.unshift(BUILTIN_IDENTITY_PLATFORM_ADMIN);
  }

  // 7. [ADR-0024] Env-side AI seat: synthesize the `ai_seat` capability from the
  //    boolean sys_user.ai_access (sqlite returns 1/0; memory returns boolean).
  if (!ctx.permissions.includes('ai_seat')) {
    const aiAccess = ((await getUserRow()) as { ai_access?: unknown } | undefined)?.ai_access;
    if (aiAccess === true || aiAccess === 1 || aiAccess === '1') ctx.permissions.push('ai_seat');
  }

  return ctx;
}

// ── Localization (ADR-0053 Phase 2) ─────────────────────────────────────────

function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}
function coerceTimeZone(value: unknown): string | undefined {
  const s = typeof value === 'string' ? value.trim() : value != null ? String(value).trim() : '';
  return s && isValidTimeZone(s) ? s : undefined;
}
function coerceLocale(value: unknown): string | undefined {
  const s = typeof value === 'string' ? value.trim() : value != null ? String(value).trim() : '';
  return s || undefined;
}
function coerceCurrency(value: unknown): string | undefined {
  const s = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(s) ? s : undefined;
}

export interface ResolveLocalizationInput {
  ql: any;
  /** Settings service exposing `get(namespace, key, { tenantId, userId })`. */
  settings?: any;
  tenantId?: string;
  userId?: string;
}

/**
 * Resolve workspace localization defaults (reference `timezone` / `locale` /
 * `currency`). Canonical path is the `localization` SettingsManifest (cascade:
 * platform default → global → tenant); falls back to direct tenant-scoped
 * `sys_setting` rows, then the built-ins `UTC` / `en-US`. Never throws.
 */
export async function resolveLocalizationContext(
  input: ResolveLocalizationInput,
): Promise<{ timezone: string; locale: string; currency?: string }> {
  const { ql, settings, tenantId, userId } = input;
  try {
    if (settings && typeof settings.get === 'function') {
      const sctx = { tenantId, userId } as any;
      const [tzRes, localeRes, currencyRes] = await Promise.all([
        settings.get('localization', 'timezone', sctx).catch(() => undefined),
        settings.get('localization', 'locale', sctx).catch(() => undefined),
        settings.get('localization', 'currency', sctx).catch(() => undefined),
      ]);
      const tz = coerceTimeZone(tzRes?.value);
      const locale = coerceLocale(localeRes?.value);
      const currency = coerceCurrency(currencyRes?.value);
      if (tz || locale || currency) return { timezone: tz ?? 'UTC', locale: locale ?? 'en-US', currency };
    }
  } catch {
    // settings service unavailable → direct read
  }
  // One read for all three keys instead of a query per key (`$in` on `key`).
  const rows = await tryFind(
    ql,
    'sys_setting',
    { namespace: 'localization', key: { $in: ['timezone', 'locale', 'currency'] }, scope: 'tenant' },
    10,
  );
  const valueOf = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    timezone: coerceTimeZone(valueOf('timezone')) ?? 'UTC',
    locale: coerceLocale(valueOf('locale')) ?? 'en-US',
    currency: coerceCurrency(valueOf('currency')),
  };
}
