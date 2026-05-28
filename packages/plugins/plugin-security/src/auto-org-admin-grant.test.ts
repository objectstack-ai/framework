// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  reconcileOrgAdminGrant,
  backfillOrgAdminGrants,
} from './auto-org-admin-grant.js';

/**
 * Tiny in-memory ObjectQL stub: just enough surface for the reconciler
 * (find / insert / delete) with isSystem context passthrough.
 */
function makeStub(seed: {
  sys_permission_set?: any[];
  sys_member?: any[];
  sys_user_permission_set?: any[];
} = {}) {
  const tables: Record<string, any[]> = {
    sys_permission_set: seed.sys_permission_set ?? [],
    sys_member: seed.sys_member ?? [],
    sys_user_permission_set: seed.sys_user_permission_set ?? [],
  };

  const matches = (row: any, where: any) => {
    for (const [k, v] of Object.entries(where ?? {})) {
      if (row[k] !== v) return false;
    }
    return true;
  };

  return {
    tables,
    async find(object: string, args: any) {
      const rows = tables[object] ?? [];
      return rows.filter((r) => matches(r, args?.where));
    },
    async insert(object: string, data: any) {
      const id = data.id ?? `${object}_${tables[object].length + 1}`;
      const row = { ...data, id };
      tables[object] = [...(tables[object] ?? []), row];
      return row;
    },
    async delete(object: string, id: string) {
      tables[object] = (tables[object] ?? []).filter((r) => r.id !== id);
      return true;
    },
  };
}

const ORG_ADMIN_SET = { id: 'ps_org_admin', name: 'organization_admin' };

describe('reconcileOrgAdminGrant', () => {
  let stub: ReturnType<typeof makeStub>;

  beforeEach(() => {
    stub = makeStub({
      sys_permission_set: [ORG_ADMIN_SET],
      sys_member: [],
      sys_user_permission_set: [],
    });
  });

  it('grants when membership role is "owner"', async () => {
    stub.tables.sys_member = [{ id: 'm1', user_id: 'u1', organization_id: 'o1', role: 'owner' }];
    const res = await reconcileOrgAdminGrant(stub, 'u1', 'o1');
    expect(res.action).toBe('granted');
    expect(stub.tables.sys_user_permission_set).toHaveLength(1);
    const row = stub.tables.sys_user_permission_set[0];
    expect(row.organization_id).toBe('o1');
    expect(row.permission_set_id).toBe('ps_org_admin');
  });

  it('grants when membership role is "admin"', async () => {
    stub.tables.sys_member = [{ id: 'm1', user_id: 'u1', organization_id: 'o1', role: 'admin' }];
    const res = await reconcileOrgAdminGrant(stub, 'u1', 'o1');
    expect(res.action).toBe('granted');
  });

  it('handles comma-separated roles like "owner,admin"', async () => {
    stub.tables.sys_member = [
      { id: 'm1', user_id: 'u1', organization_id: 'o1', role: 'owner,admin' },
    ];
    const res = await reconcileOrgAdminGrant(stub, 'u1', 'o1');
    expect(res.action).toBe('granted');
  });

  it('does NOT grant when role is just "member"', async () => {
    stub.tables.sys_member = [{ id: 'm1', user_id: 'u1', organization_id: 'o1', role: 'member' }];
    const res = await reconcileOrgAdminGrant(stub, 'u1', 'o1');
    expect(res.action).toBe('noop');
    expect(stub.tables.sys_user_permission_set).toHaveLength(0);
  });

  it('revokes the scoped grant on demotion (admin → member)', async () => {
    stub.tables.sys_member = [{ id: 'm1', user_id: 'u1', organization_id: 'o1', role: 'member' }];
    stub.tables.sys_user_permission_set = [
      {
        id: 'ups1',
        user_id: 'u1',
        organization_id: 'o1',
        permission_set_id: 'ps_org_admin',
      },
    ];
    const res = await reconcileOrgAdminGrant(stub, 'u1', 'o1');
    expect(res.action).toBe('revoked');
    expect(stub.tables.sys_user_permission_set).toHaveLength(0);
  });

  it('revokes when membership is gone entirely', async () => {
    stub.tables.sys_user_permission_set = [
      {
        id: 'ups1',
        user_id: 'u1',
        organization_id: 'o1',
        permission_set_id: 'ps_org_admin',
      },
    ];
    const res = await reconcileOrgAdminGrant(stub, 'u1', 'o1');
    expect(res.action).toBe('revoked');
  });

  it('is idempotent — re-running keeps exactly one grant row', async () => {
    stub.tables.sys_member = [{ id: 'm1', user_id: 'u1', organization_id: 'o1', role: 'owner' }];
    await reconcileOrgAdminGrant(stub, 'u1', 'o1');
    const res = await reconcileOrgAdminGrant(stub, 'u1', 'o1');
    expect(res.action).toBe('noop');
    expect(stub.tables.sys_user_permission_set).toHaveLength(1);
  });

  it('only grants org-scoped (organization_id is set, not null)', async () => {
    stub.tables.sys_member = [{ id: 'm1', user_id: 'u1', organization_id: 'o1', role: 'owner' }];
    await reconcileOrgAdminGrant(stub, 'u1', 'o1');
    const grant = stub.tables.sys_user_permission_set[0];
    expect(grant.organization_id).toBe('o1');
    expect(grant.organization_id).not.toBeNull();
  });

  it('skips cleanly when the permission set is not seeded', async () => {
    stub.tables.sys_permission_set = [];
    stub.tables.sys_member = [{ id: 'm1', user_id: 'u1', organization_id: 'o1', role: 'owner' }];
    const res = await reconcileOrgAdminGrant(stub, 'u1', 'o1');
    expect(res.action).toBe('skipped');
    expect(res.reason).toBe('permission_set_missing');
  });
});

describe('backfillOrgAdminGrants', () => {
  it('grants for every owner/admin membership and revokes orphans', async () => {
    const stub = makeStub({
      sys_permission_set: [ORG_ADMIN_SET],
      sys_member: [
        { id: 'm1', user_id: 'u1', organization_id: 'o1', role: 'owner' },
        { id: 'm2', user_id: 'u2', organization_id: 'o1', role: 'admin' },
        { id: 'm3', user_id: 'u3', organization_id: 'o1', role: 'member' },
      ],
      sys_user_permission_set: [
        // Orphan grant — no matching membership in o2.
        {
          id: 'ups_orphan',
          user_id: 'u4',
          organization_id: 'o2',
          permission_set_id: 'ps_org_admin',
        },
      ],
    });

    const summary = await backfillOrgAdminGrants(stub);
    expect(summary.scanned).toBe(3);
    expect(summary.granted).toBe(2);
    expect(summary.revoked).toBe(1);

    const grants = stub.tables.sys_user_permission_set;
    expect(grants).toHaveLength(2);
    const grantedUsers = grants.map((g) => g.user_id).sort();
    expect(grantedUsers).toEqual(['u1', 'u2']);
  });
});
