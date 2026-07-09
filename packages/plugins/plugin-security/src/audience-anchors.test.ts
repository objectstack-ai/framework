// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
// ADR-0090 D5/D9 — audience anchors: everyone/guest seeding and the
// high-privilege binding gate.

import { describe, it, expect } from 'vitest';
import { describeAnchorForbiddenBits } from '@objectstack/spec/security';
import { bootstrapBuiltinRoles } from './bootstrap-builtin-positions';
import { describeHighPrivilegeBits } from './security-plugin';

function makeQl() {
  const tables: Record<string, any[]> = { sys_position: [] };
  return {
    tables,
    async find(object: string, opts: any) {
      const where = opts?.where ?? {};
      return (tables[object] ?? []).filter((r) =>
        Object.entries(where).every(([k, v]) => (r as any)[k] === v),
      );
    },
    async insert(object: string, data: any) {
      (tables[object] ??= []).push(data);
      return data;
    },
    async update(object: string, data: any) {
      const t = tables[object] ?? [];
      const i = t.findIndex((r) => r.id === data.id);
      if (i >= 0) t[i] = { ...t[i], ...data };
      return t[i];
    },
  } as any;
}

describe('audience anchors (ADR-0090 D5/D9)', () => {
  it('seeds everyone and guest alongside the builtin identity names', async () => {
    const ql = makeQl();
    const res = await bootstrapBuiltinRoles(ql);
    const names = ql.tables.sys_position.map((r: any) => r.name);
    expect(names).toEqual(
      expect.arrayContaining(['platform_admin', 'org_owner', 'org_admin', 'org_member', 'everyone', 'guest']),
    );
    expect(res.seeded).toBe(6);
    // system-managed, undeletable posture
    for (const r of ql.tables.sys_position) expect(r.managed_by).toBe('system');
  });

  it('re-seed is idempotent (updates, no duplicates)', async () => {
    const ql = makeQl();
    await bootstrapBuiltinRoles(ql);
    const res2 = await bootstrapBuiltinRoles(ql);
    expect(res2.seeded).toBe(0);
    expect(ql.tables.sys_position.filter((r: any) => r.name === 'everyone')).toHaveLength(1);
  });
});

describe('describeHighPrivilegeBits (anchor-binding predicate)', () => {
  it('flags VAMA, destructive bits, wildcards and system permissions', () => {
    expect(describeHighPrivilegeBits({ objects: { a: { viewAllRecords: true } } })).toMatch(/View\/Modify All/);
    expect(describeHighPrivilegeBits({ objects: { a: { modifyAllRecords: true } } })).toMatch(/View\/Modify All/);
    expect(describeHighPrivilegeBits({ objects: { a: { allowDelete: true } } })).toMatch(/delete\/purge\/transfer/);
    expect(describeHighPrivilegeBits({ objects: { a: { allowPurge: true } } })).toMatch(/delete\/purge\/transfer/);
    expect(describeHighPrivilegeBits({ objects: { a: { allowTransfer: true } } })).toMatch(/delete\/purge\/transfer/);
    expect(describeHighPrivilegeBits({ objects: { '*': { allowRead: true } } })).toMatch(/wildcard/);
    expect(describeHighPrivilegeBits({ systemPermissions: ['manage_users'], objects: {} })).toMatch(/system permissions/);
  });

  it('accepts a low-privilege self-service set (the intended anchor shape)', () => {
    expect(
      describeHighPrivilegeBits({
        objects: { crm_account: { allowRead: true }, helpdesk_ticket: { allowCreate: true, allowRead: true, allowEdit: true } },
      }),
    ).toBeNull();
  });

  it('reads the sys_permission_set ROW shape too (JSON string columns, snake_case)', () => {
    expect(describeHighPrivilegeBits({ objects: JSON.stringify({ a: { modifyAllRecords: true } }) })).toMatch(/View\/Modify All/);
    expect(describeHighPrivilegeBits({ system_permissions: ['setup.access'] })).toMatch(/system permissions/);
    expect(describeHighPrivilegeBits({ objects: JSON.stringify({ a: { allowRead: true } }) })).toBeNull();
  });
});

describe('describeAnchorForbiddenBits (ADR-0090 D9 anchor tiers)', () => {
  it('guest faces the strictest tier: edit bits are refused on top of the high-privilege set', () => {
    const editSet = { objects: { helpdesk_ticket: { allowRead: true, allowEdit: true } } };
    expect(describeAnchorForbiddenBits(editSet, 'everyone')).toBeNull(); // everyone: edit OK
    expect(describeAnchorForbiddenBits(editSet, 'guest')).toMatch(/read-only/); // guest: refused
  });

  it('guest allows read + case-by-case create (public form intake shape)', () => {
    expect(
      describeAnchorForbiddenBits(
        { objects: { form_submission: { allowRead: true, allowCreate: true } } },
        'guest',
      ),
    ).toBeNull();
  });

  it('high-privilege bits stay refused for BOTH anchors', () => {
    const vama = { objects: { a: { viewAllRecords: true } } };
    expect(describeAnchorForbiddenBits(vama, 'everyone')).toMatch(/View\/Modify All/);
    expect(describeAnchorForbiddenBits(vama, 'guest')).toMatch(/View\/Modify All/);
  });
});
