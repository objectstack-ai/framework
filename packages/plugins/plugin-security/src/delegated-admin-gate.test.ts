// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
// ADR-0090 D12 — delegated administration: scoped admin, no self-escalation.

import { describe, it, expect, beforeEach } from 'vitest';
import { DelegatedAdminGate } from './delegated-admin-gate';

/**
 * Fixture topology
 *
 *   hq (bu_hq)
 *   ├── east (bu_east)          ← delegate's subtree root
 *   │   └── east_sales (bu_es)
 *   └── west (bu_west)
 *
 * Permission sets: sales_user (allowlisted, plain), finance_admin (NOT
 * allowlisted), sub_admin (carries the delegate's adminScope), admin_full
 * (tenant superuser wildcard).
 * Positions: sales_rep → [sales_user]; mixed_pos → [sales_user, finance_admin];
 * everyone (anchor).
 */

const EAST_SCOPE = {
  businessUnit: 'east',
  includeSubtree: true,
  manageAssignments: true,
  manageBindings: true,
  authorEnvironmentSets: true,
  assignablePermissionSets: ['sales_user', 'sub_admin'],
};

function makeHarness() {
  const tables: Record<string, any[]> = {
    sys_business_unit: [
      { id: 'bu_hq', name: 'hq', parent_business_unit_id: null },
      { id: 'bu_east', name: 'east', parent_business_unit_id: 'bu_hq' },
      { id: 'bu_es', name: 'east_sales', parent_business_unit_id: 'bu_east' },
      { id: 'bu_west', name: 'west', parent_business_unit_id: 'bu_hq' },
    ],
    sys_position: [
      { id: 'pos_sales', name: 'sales_rep' },
      { id: 'pos_mixed', name: 'mixed_pos' },
      { id: 'pos_everyone', name: 'everyone' },
    ],
    sys_permission_set: [
      { id: 'ps_sales', name: 'sales_user' },
      { id: 'ps_fin', name: 'finance_admin' },
      { id: 'ps_sub', name: 'sub_admin', admin_scope: JSON.stringify(EAST_SCOPE) },
    ],
    sys_position_permission_set: [
      { id: 'b1', position_id: 'pos_sales', permission_set_id: 'ps_sales' },
      { id: 'b2', position_id: 'pos_mixed', permission_set_id: 'ps_sales' },
      { id: 'b3', position_id: 'pos_mixed', permission_set_id: 'ps_fin' },
    ],
    sys_user_position: [
      { id: 'a_prev', user_id: 'u_east_1', position: 'sales_rep', business_unit_id: 'bu_es' },
    ],
    sys_business_unit_member: [
      { id: 'm1', business_unit_id: 'bu_es', user_id: 'u_east_1' },
      { id: 'm2', business_unit_id: 'bu_west', user_id: 'u_west_1' },
    ],
    sys_user: [
      { id: 'u_delegate' }, { id: 'u_east_1' }, { id: 'u_west_1' },
    ],
  };

  const matches = (row: any, where: any): boolean =>
    Object.entries(where ?? {}).every(([k, v]) => {
      if (v && typeof v === 'object' && Array.isArray((v as any).$in)) {
        return (v as any).$in.includes(row[k]);
      }
      return row[k] === v;
    });

  const ql = {
    tables,
    async find(object: string, opts: any) {
      const rows = (tables[object] ?? []).filter((r) => matches(r, opts?.where));
      return typeof opts?.limit === 'number' ? rows.slice(0, opts.limit) : rows;
    },
    async findOne(object: string, opts: any) {
      const rows = (tables[object] ?? []).filter((r) => matches(r, opts?.where));
      return rows[0] ?? null;
    },
  } as any;

  // Resolved permission sets per principal — mirrors what
  // resolvePermissionSetsForContext would return for each context.
  const SETS: Record<string, any[]> = {
    tenant_admin: [{ name: 'admin_full', objects: { '*': { allowRead: true, modifyAllRecords: true } } }],
    delegate: [
      { name: 'member_default', objects: {} },
      { name: 'sub_admin', objects: { sys_user_position: { allowRead: true, allowCreate: true, allowEdit: true, allowDelete: true } }, adminScope: EAST_SCOPE },
    ],
    crud_only: [{ name: 'rbac_crud', objects: { sys_user_position: { allowRead: true, allowCreate: true, allowEdit: true, allowDelete: true } } }],
  };

  const gate = new DelegatedAdminGate({
    ql,
    resolveSets: async (context: any) => SETS[context?.principal ?? ''] ?? [],
  });

  const ctxOf = (principal: string, userId = `u_${principal}`) => ({ principal, userId, positions: [principal] });
  return { gate, ql, tables, ctxOf };
}

let h: ReturnType<typeof makeHarness>;
beforeEach(() => { h = makeHarness(); });

const insertAssignment = (ctx: any, row: any) => h.gate.assert({
  object: 'sys_user_position', operation: 'insert', data: row, context: ctx,
});

describe('DelegatedAdminGate — tenant admins and outsiders', () => {
  it('tenant-level admin (superuser wildcard) passes untouched', async () => {
    await expect(insertAssignment(h.ctxOf('tenant_admin'), {
      user_id: 'u_west_1', position: 'mixed_pos', business_unit_id: 'bu_west',
    })).resolves.toBeUndefined();
  });

  it('plain CRUD on RBAC tables no longer makes a permission administrator', async () => {
    await expect(insertAssignment(h.ctxOf('crud_only'), {
      user_id: 'u_east_1', position: 'sales_rep', business_unit_id: 'bu_es',
    })).rejects.toThrow(/delegated adminScope/);
  });

  it('principal-less non-system writes to RBAC tables fail closed', async () => {
    await expect(insertAssignment({}, {
      user_id: 'u_east_1', position: 'sales_rep', business_unit_id: 'bu_es',
    })).rejects.toThrow(/authenticated administrator/);
  });

  it('reads and non-governed objects are untouched', async () => {
    await expect(h.gate.assert({ object: 'sys_user_position', operation: 'find', context: {} }))
      .resolves.toBeUndefined();
    await expect(h.gate.assert({ object: 'task', operation: 'insert', data: {}, context: {} }))
      .resolves.toBeUndefined();
  });
});

describe('DelegatedAdminGate — assignments (sys_user_position)', () => {
  it('delegate assigns an allowlisted position inside the subtree; granted_by is stamped', async () => {
    const row: any = { user_id: 'u_east_1', position: 'sales_rep', business_unit_id: 'bu_es' };
    await expect(insertAssignment(h.ctxOf('delegate'), row)).resolves.toBeUndefined();
    expect(row.granted_by).toBe('u_delegate'); // audit stamp
  });

  it('denies when the position distributes a set outside the allowlist', async () => {
    await expect(insertAssignment(h.ctxOf('delegate'), {
      user_id: 'u_east_1', position: 'mixed_pos', business_unit_id: 'bu_es',
    })).rejects.toThrow(/finance_admin.*not in the scope's allowlist/);
  });

  it('denies assignments anchored outside the subtree', async () => {
    await expect(insertAssignment(h.ctxOf('delegate'), {
      user_id: 'u_west_1', position: 'sales_rep', business_unit_id: 'bu_west',
    })).rejects.toThrow(/outside the delegated subtree/);
  });

  it('denies unanchored assignments (no business_unit_id)', async () => {
    await expect(insertAssignment(h.ctxOf('delegate'), {
      user_id: 'u_east_1', position: 'sales_rep',
    })).rejects.toThrow(/no business_unit_id anchor/);
  });

  it('no self-carve-out: delegate self-assigning a non-allowlisted position is denied', async () => {
    await expect(insertAssignment(h.ctxOf('delegate'), {
      user_id: 'u_delegate', position: 'mixed_pos', business_unit_id: 'bu_es',
    })).rejects.toThrow(/allowlist/);
  });

  it('anchors are never assignable — for delegates AND tenant admins', async () => {
    for (const principal of ['delegate', 'tenant_admin']) {
      await expect(insertAssignment(h.ctxOf(principal), {
        user_id: 'u_east_1', position: 'everyone', business_unit_id: 'bu_es',
      })).rejects.toThrow(/audience anchor is implicit/);
    }
  });

  it('update cannot move an assignment out of the subtree', async () => {
    await expect(h.gate.assert({
      object: 'sys_user_position', operation: 'update',
      data: { id: 'a_prev', business_unit_id: 'bu_west' },
      context: h.ctxOf('delegate'),
    })).rejects.toThrow(/outside the delegated subtree/);
  });

  it('delete of an in-subtree assignment is allowed; filter writes are not', async () => {
    await expect(h.gate.assert({
      object: 'sys_user_position', operation: 'delete',
      options: { where: { id: 'a_prev' } },
      context: h.ctxOf('delegate'),
    })).resolves.toBeUndefined();

    await expect(h.gate.assert({
      object: 'sys_user_position', operation: 'delete',
      options: { where: { position: 'sales_rep' } },
      context: h.ctxOf('delegate'),
    })).rejects.toThrow(/single rows by id/);
  });
});

describe('DelegatedAdminGate — bindings (sys_position_permission_set)', () => {
  it('delegate binds an allowlisted set to a position held only inside the subtree', async () => {
    await expect(h.gate.assert({
      object: 'sys_position_permission_set', operation: 'insert',
      data: { position_id: 'pos_sales', permission_set_id: 'ps_sales' },
      context: h.ctxOf('delegate'),
    })).resolves.toBeUndefined();
  });

  it('denies binding a non-allowlisted set', async () => {
    await expect(h.gate.assert({
      object: 'sys_position_permission_set', operation: 'insert',
      data: { position_id: 'pos_sales', permission_set_id: 'ps_fin' },
      context: h.ctxOf('delegate'),
    })).rejects.toThrow(/not in the scope's allowlist/);
  });

  it('denies re-composing a position held outside the subtree (blast radius)', async () => {
    h.tables.sys_user_position.push({ id: 'a_w', user_id: 'u_west_1', position: 'sales_rep', business_unit_id: 'bu_west' });
    await expect(h.gate.assert({
      object: 'sys_position_permission_set', operation: 'insert',
      data: { position_id: 'pos_sales', permission_set_id: 'ps_sales' },
      context: h.ctxOf('delegate'),
    })).rejects.toThrow(/outside the delegated subtree/);
  });

  it('audience-anchor bindings are tenant-level only for delegates', async () => {
    await expect(h.gate.assert({
      object: 'sys_position_permission_set', operation: 'insert',
      data: { position_id: 'pos_everyone', permission_set_id: 'ps_sales' },
      context: h.ctxOf('delegate'),
    })).rejects.toThrow(/tenant-level only/);
  });
});

describe('DelegatedAdminGate — direct grants (sys_user_permission_set)', () => {
  it('delegate grants an allowlisted set to a user inside the subtree; granted_by stamped', async () => {
    const row: any = { user_id: 'u_east_1', permission_set_id: 'ps_sales' };
    await expect(h.gate.assert({
      object: 'sys_user_permission_set', operation: 'insert', data: row, context: h.ctxOf('delegate'),
    })).resolves.toBeUndefined();
    expect(row.granted_by).toBe('u_delegate');
  });

  it('denies grants to users outside the subtree', async () => {
    await expect(h.gate.assert({
      object: 'sys_user_permission_set', operation: 'insert',
      data: { user_id: 'u_west_1', permission_set_id: 'ps_sales' },
      context: h.ctxOf('delegate'),
    })).rejects.toThrow(/outside the delegated subtree/);
  });

  it('denies non-allowlisted sets — including to the delegate themselves', async () => {
    await expect(h.gate.assert({
      object: 'sys_user_permission_set', operation: 'insert',
      data: { user_id: 'u_delegate', permission_set_id: 'ps_fin' },
      context: h.ctxOf('delegate'),
    })).rejects.toThrow(/not in the scope's allowlist/);
  });

  it('granting a set that carries an adminScope requires STRICT containment (equal scope refused)', async () => {
    // sub_admin carries the delegate's own EXACT scope — lateral propagation banned.
    await expect(h.gate.assert({
      object: 'sys_user_permission_set', operation: 'insert',
      data: { user_id: 'u_east_1', permission_set_id: 'ps_sub' },
      context: h.ctxOf('delegate'),
    })).rejects.toThrow(/not strictly contained/);
  });
});

describe('DelegatedAdminGate — env-set authoring (sys_permission_set)', () => {
  it('delegate with authorEnvironmentSets may insert an inert env set', async () => {
    await expect(h.gate.assert({
      object: 'sys_permission_set', operation: 'insert',
      data: { name: 'east_helper', object_permissions: '{}' },
      context: h.ctxOf('delegate'),
    })).resolves.toBeUndefined();
  });

  it('authoring a set that mints a NARROWER adminScope is allowed (strict containment)', async () => {
    await expect(h.gate.assert({
      object: 'sys_permission_set', operation: 'insert',
      data: {
        name: 'east_sales_admin',
        admin_scope: JSON.stringify({
          businessUnit: 'east_sales',
          manageAssignments: true,
          assignablePermissionSets: ['sales_user'],
        }),
      },
      context: h.ctxOf('delegate'),
    })).resolves.toBeUndefined();
  });

  it('authoring a scope equal to or broader than your own is denied', async () => {
    await expect(h.gate.assert({
      object: 'sys_permission_set', operation: 'insert',
      data: { name: 'clone_of_mine', admin_scope: JSON.stringify(EAST_SCOPE) },
      context: h.ctxOf('delegate'),
    })).rejects.toThrow(/strictly contains it/);

    await expect(h.gate.assert({
      object: 'sys_permission_set', operation: 'insert',
      data: {
        name: 'hq_takeover',
        admin_scope: JSON.stringify({ ...EAST_SCOPE, businessUnit: 'hq' }),
      },
      context: h.ctxOf('delegate'),
    })).rejects.toThrow(/strictly contains it/);
  });

  it('delegates cannot set the tenant-wide isDefault suggestion', async () => {
    await expect(h.gate.assert({
      object: 'sys_permission_set', operation: 'insert',
      data: { name: 'east_default', isDefault: true },
      context: h.ctxOf('delegate'),
    })).rejects.toThrow(/tenant-level/);
  });
});
