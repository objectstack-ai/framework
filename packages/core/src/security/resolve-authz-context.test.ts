// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { resolveAuthzContext } from './resolve-authz-context.js';

/**
 * Contract test for the SINGLE authorization resolver. Every authorization
 * source MUST be honored here — this is the regression net that would have
 * caught the REST-vs-dispatcher drift (the REST copy had silently dropped
 * sys_user_role / sys_role_permission_set / platform_admin / ai_seat).
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
  it('resolves a custom role granted via sys_user_role (the REST-drift bug)', async () => {
    const ql = makeQl({
      sys_user: [{ id: 'u1', email: 'ada@x.com' }],
      sys_member: [],
      sys_user_role: [{ user_id: 'u1', role: 'contributor', organization_id: null }],
      sys_user_permission_set: [],
    });
    const ctx = await resolveAuthzContext({ ql, headers: H(), getSession: session('u1') });
    expect(ctx.roles).toContain('contributor');
  });

  it('normalizes sys_member org roles (owner -> org_owner)', async () => {
    const ql = makeQl({
      sys_user: [{ id: 'u1' }],
      sys_member: [{ user_id: 'u1', role: 'owner', organization_id: 'o1' }],
      sys_user_role: [],
      sys_user_permission_set: [],
    });
    const ctx = await resolveAuthzContext({ ql, headers: H(), getSession: session('u1', { org: 'o1' }) });
    expect(ctx.roles).toContain('org_owner');
  });

  it('resolves role-bound permission sets (sys_role_permission_set)', async () => {
    const ql = makeQl({
      sys_user: [{ id: 'u1' }],
      sys_member: [],
      sys_user_role: [{ user_id: 'u1', role: 'contributor', organization_id: null }],
      sys_user_permission_set: [],
      sys_role: [{ id: 'r1', name: 'contributor' }],
      sys_role_permission_set: [{ role_id: 'r1', permission_set_id: 'ps1' }],
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
      sys_user_role: [],
      sys_user_permission_set: [{ user_id: 'u1', permission_set_id: 'psA', organization_id: null }],
      sys_permission_set: [{ id: 'psA', name: 'admin_full_access' }],
    });
    const ctx = await resolveAuthzContext({ ql, headers: H(), getSession: session('u1') });
    expect(ctx.roles).toContain('platform_admin');
  });

  it('does NOT derive platform_admin from an ORG-scoped admin_full_access grant', async () => {
    const ql = makeQl({
      sys_user: [{ id: 'u1' }],
      sys_member: [],
      sys_user_role: [],
      sys_user_permission_set: [{ user_id: 'u1', permission_set_id: 'psA', organization_id: 'o1' }],
      sys_permission_set: [{ id: 'psA', name: 'admin_full_access' }],
    });
    const ctx = await resolveAuthzContext({ ql, headers: H(), getSession: session('u1', { org: 'o1' }) });
    expect(ctx.roles).not.toContain('platform_admin');
  });

  it('synthesizes ai_seat from sys_user.ai_access (sqlite integer 1)', async () => {
    const ql = makeQl({
      sys_user: [{ id: 'u1', ai_access: 1 }],
      sys_member: [],
      sys_user_role: [],
      sys_user_permission_set: [],
    });
    const ctx = await resolveAuthzContext({ ql, headers: H(), getSession: session('u1') });
    expect(ctx.permissions).toContain('ai_seat');
  });

  it('anonymous (no session, no api key) → empty context', async () => {
    const ctx = await resolveAuthzContext({ ql: makeQl({}), headers: H(), getSession: async () => undefined });
    expect(ctx.userId).toBeUndefined();
    expect(ctx.roles).toEqual([]);
    expect(ctx.permissions).toEqual([]);
  });
});
