// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { resolveAuthzContext, resolveLocalizationContext } from './resolve-authz-context.js';

/**
 * Contract test for the SINGLE authorization resolver. Every authorization
 * source MUST be honored here — this is the regression net that would have
 * caught the REST-vs-dispatcher drift (the REST copy had silently dropped
 * sys_user_position / sys_position_permission_set / platform_admin / ai_seat).
 */

// Minimal in-memory ObjectQL: find(object, { where }) with `===` + `$in` match.
function makeQl(tables: Record<string, any[]>) {
  return {
    async find(object: string, opts: any) {
      const rows = tables[object] ?? [];
      const where = opts?.where ?? {};
      return rows.filter((r) =>
        Object.entries(where).every(([k, v]) => {
          if (v && typeof v === 'object' && '$in' in (v as any)) return (v as any).$in.includes(r[k]);
          return r[k] === v;
        }),
      );
    },
  };
}
const session = (userId: string, opts: { email?: string; org?: string } = {}) =>
  async () => ({ user: { id: userId, email: opts.email }, session: { activeOrganizationId: opts.org ?? null } });
const H = () => new Headers();

describe('resolveAuthzContext — single source of truth', () => {
  it('resolves a custom role granted via sys_user_position (the REST-drift bug)', async () => {
    const ql = makeQl({
      sys_user: [{ id: 'u1', email: 'ada@x.com' }],
      sys_member: [],
      sys_user_position: [{ user_id: 'u1', position: 'contributor', organization_id: null }],
      sys_user_permission_set: [],
    });
    const ctx = await resolveAuthzContext({ ql, headers: H(), getSession: session('u1') });
    expect(ctx.positions).toContain('contributor');
  });

  it('normalizes sys_member org roles (owner -> org_owner)', async () => {
    const ql = makeQl({
      sys_user: [{ id: 'u1' }],
      sys_member: [{ user_id: 'u1', role: 'owner', organization_id: 'o1' }],
      sys_user_position: [],
      sys_user_permission_set: [],
    });
    const ctx = await resolveAuthzContext({ ql, headers: H(), getSession: session('u1', { org: 'o1' }) });
    expect(ctx.positions).toContain('org_owner');
  });

  it('resolves role-bound permission sets (sys_position_permission_set)', async () => {
    const ql = makeQl({
      sys_user: [{ id: 'u1' }],
      sys_member: [],
      sys_user_position: [{ user_id: 'u1', position: 'contributor', organization_id: null }],
      sys_user_permission_set: [],
      sys_position: [{ id: 'r1', name: 'contributor' }],
      sys_position_permission_set: [{ position_id: 'r1', permission_set_id: 'ps1' }],
      sys_permission_set: [{ id: 'ps1', name: 'contributor_ps', system_permissions: ['cap_x'] }],
    });
    const ctx = await resolveAuthzContext({ ql, headers: H(), getSession: session('u1') });
    expect(ctx.permissions).toContain('contributor_ps');
    expect(ctx.systemPermissions).toContain('cap_x');
  });

  it('derives platform_admin from an UNSCOPED admin_full_access user grant', async () => {
    const ql = makeQl({
      sys_user: [{ id: 'u1' }],
      sys_member: [],
      sys_user_position: [],
      sys_user_permission_set: [{ user_id: 'u1', permission_set_id: 'psA', organization_id: null }],
      sys_permission_set: [{ id: 'psA', name: 'admin_full_access' }],
    });
    const ctx = await resolveAuthzContext({ ql, headers: H(), getSession: session('u1') });
    expect(ctx.positions).toContain('platform_admin');
  });

  it('does NOT derive platform_admin from an ORG-scoped admin_full_access grant', async () => {
    const ql = makeQl({
      sys_user: [{ id: 'u1' }],
      sys_member: [],
      sys_user_position: [],
      sys_user_permission_set: [{ user_id: 'u1', permission_set_id: 'psA', organization_id: 'o1' }],
      sys_permission_set: [{ id: 'psA', name: 'admin_full_access' }],
    });
    const ctx = await resolveAuthzContext({ ql, headers: H(), getSession: session('u1', { org: 'o1' }) });
    expect(ctx.positions).not.toContain('platform_admin');
  });

  it('synthesizes ai_seat from sys_user.ai_access (sqlite integer 1)', async () => {
    const ql = makeQl({
      sys_user: [{ id: 'u1', ai_access: 1 }],
      sys_member: [],
      sys_user_position: [],
      sys_user_permission_set: [],
    });
    const ctx = await resolveAuthzContext({ ql, headers: H(), getSession: session('u1') });
    expect(ctx.permissions).toContain('ai_seat');
  });

  it('anonymous (no session, no api key) → empty context', async () => {
    const ctx = await resolveAuthzContext({ ql: makeQl({}), headers: H(), getSession: async () => undefined });
    expect(ctx.userId).toBeUndefined();
    expect(ctx.positions).toEqual([]);
    expect(ctx.permissions).toEqual([]);
  });
});

// A counting ObjectQL: records how many find() calls hit each object so we can
// assert the de-duplication of redundant authz/localization reads (#2409).
function makeCountingQl(tables: Record<string, any[]>) {
  const counts: Record<string, number> = {};
  return {
    counts,
    async find(object: string, opts: any) {
      counts[object] = (counts[object] ?? 0) + 1;
      const rows = tables[object] ?? [];
      const where = opts?.where ?? {};
      return rows.filter((r) =>
        Object.entries(where).every(([k, v]) => {
          if (v && typeof v === 'object' && '$in' in (v as any)) return (v as any).$in.includes(r[k]);
          return r[k] === v;
        }),
      );
    },
  };
}

describe('resolveAuthzContext — request-scoped read de-duplication (#2409)', () => {
  it('reads sys_user at most once even when both email fallback and ai_seat need it', async () => {
    // No email in the session → email fallback reads sys_user; ai_seat synthesis
    // also needs sys_user. Previously these were two separate queries.
    const ql = makeCountingQl({
      sys_user: [{ id: 'u1', email: 'ada@x.com', ai_access: 1 }],
      sys_member: [],
      sys_user_position: [],
      sys_user_permission_set: [],
    });
    const ctx = await resolveAuthzContext({ ql, headers: H(), getSession: session('u1') });
    expect(ctx.email).toBe('ada@x.com');
    expect(ctx.permissions).toContain('ai_seat');
    expect(ql.counts.sys_user).toBe(1);
  });
});

describe('resolveLocalizationContext — batched fallback read (#2409)', () => {
  it('reads sys_setting once (all three keys) when no settings service is wired', async () => {
    const ql = makeCountingQl({
      sys_setting: [
        { namespace: 'localization', key: 'timezone', scope: 'tenant', value: 'Asia/Tokyo' },
        { namespace: 'localization', key: 'locale', scope: 'tenant', value: 'ja-JP' },
        { namespace: 'localization', key: 'currency', scope: 'tenant', value: 'JPY' },
      ],
    });
    const loc = await resolveLocalizationContext({ ql, tenantId: 'o1' });
    expect(loc).toEqual({ timezone: 'Asia/Tokyo', locale: 'ja-JP', currency: 'JPY' });
    expect(ql.counts.sys_setting).toBe(1);
  });

  it('falls back to UTC / en-US when no rows exist', async () => {
    const ql = makeCountingQl({ sys_setting: [] });
    const loc = await resolveLocalizationContext({ ql });
    expect(loc.timezone).toBe('UTC');
    expect(loc.locale).toBe('en-US');
    expect(loc.currency).toBeUndefined();
  });
});
