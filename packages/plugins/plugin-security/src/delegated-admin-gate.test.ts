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

// ── [ADR-0091 D3] Self-service delegation of duty ──────────────────────────

const T0 = Date.parse('2026-07-01T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Delegation fixture: a non-admin holder of a `delegatable` position may
 * assign it to a delegate, time-boxed, WITHOUT any adminScope.
 *
 *   approver   (delegatable) → [approve_set]        ← u_boss holds directly
 *   admin_pos  (delegatable) → [sub_admin/adminScope] ← u_boss holds directly
 *   plain_pos  (NOT delegatable)                     ← u_boss holds directly
 *   spare_pos  (delegatable)                         ← u_boss does NOT hold
 *   approver                                         ← u_relay holds via delegation
 */
function makeDelegationHarness(nowMs = T0) {
  const tables: Record<string, any[]> = {
    sys_position: [
      { id: 'p_appr', name: 'approver', delegatable: true },
      { id: 'p_admin', name: 'admin_pos', delegatable: true },
      { id: 'p_plain', name: 'plain_pos', delegatable: false },
      { id: 'p_spare', name: 'spare_pos', delegatable: true },
      { id: 'p_everyone', name: 'everyone' },
    ],
    sys_permission_set: [
      { id: 's_appr', name: 'approve_set' },
      { id: 's_sub', name: 'sub_admin', admin_scope: JSON.stringify(EAST_SCOPE) },
    ],
    sys_position_permission_set: [
      { id: 'b_appr', position_id: 'p_appr', permission_set_id: 's_appr' },
      { id: 'b_admin', position_id: 'p_admin', permission_set_id: 's_sub' },
    ],
    sys_user_position: [
      { id: 'h1', user_id: 'u_boss', position: 'approver' },
      { id: 'h2', user_id: 'u_boss', position: 'plain_pos' },
      { id: 'h3', user_id: 'u_boss', position: 'admin_pos' },
      { id: 'h4', user_id: 'u_relay', position: 'approver', delegated_from: 'u_boss', valid_until: iso(nowMs + 20 * DAY) },
    ],
    sys_user: [{ id: 'u_boss' }, { id: 'u_relay' }, { id: 'u_deleg' }],
  };
  const matches = (row: any, where: any): boolean =>
    Object.entries(where ?? {}).every(([k, v]) => {
      if (v && typeof v === 'object' && Array.isArray((v as any).$in)) return (v as any).$in.includes(row[k]);
      return row[k] === v;
    });
  const ql = {
    tables,
    async find(object: string, opts: any) {
      const rows = (tables[object] ?? []).filter((r) => matches(r, opts?.where));
      return typeof opts?.limit === 'number' ? rows.slice(0, opts.limit) : rows;
    },
    async findOne(object: string, opts: any) {
      return (tables[object] ?? []).filter((r) => matches(r, opts?.where))[0] ?? null;
    },
  } as any;
  const gate = new DelegatedAdminGate({
    ql,
    resolveSets: async () => [{ name: 'member_default', objects: {} }],
    now: () => nowMs,
  });
  const delegate = (userId: string, row: any) =>
    gate.assert({ object: 'sys_user_position', operation: 'insert', data: row, context: { userId, positions: [] } });
  return { gate, ql, tables, delegate };
}

describe('DelegatedAdminGate — self-service delegation of duty (ADR-0091 D3)', () => {
  it('a direct holder delegates a delegatable position, time-boxed + reasoned; granted_by is stamped', async () => {
    const d = makeDelegationHarness();
    const row: any = { user_id: 'u_deleg', position: 'approver', delegated_from: 'u_boss', valid_until: iso(T0 + 10 * DAY), reason: 'vacation stand-in' };
    await expect(d.delegate('u_boss', row)).resolves.toBeUndefined();
    expect(row.granted_by).toBe('u_boss'); // dual audit: writer + authority source
  });

  it('a delegation with no valid_until is rejected (an open-ended delegation is a permanent grant)', async () => {
    const d = makeDelegationHarness();
    await expect(d.delegate('u_boss', { user_id: 'u_deleg', position: 'approver', delegated_from: 'u_boss', reason: 'x' }))
      .rejects.toThrow(/requires a valid_until/);
  });

  it('valid_until in the past is rejected', async () => {
    const d = makeDelegationHarness();
    await expect(d.delegate('u_boss', { user_id: 'u_deleg', position: 'approver', delegated_from: 'u_boss', valid_until: iso(T0 - DAY), reason: 'x' }))
      .rejects.toThrow(/not in the future/);
  });

  it('valid_until beyond the 30-day ceiling is rejected; exactly at the ceiling is allowed', async () => {
    const d = makeDelegationHarness();
    await expect(d.delegate('u_boss', { user_id: 'u_deleg', position: 'approver', delegated_from: 'u_boss', valid_until: iso(T0 + 31 * DAY), reason: 'x' }))
      .rejects.toThrow(/ceiling/);
    await expect(d.delegate('u_boss', { user_id: 'u_deleg', position: 'approver', delegated_from: 'u_boss', valid_until: iso(T0 + 30 * DAY), reason: 'x' }))
      .resolves.toBeUndefined();
  });

  it('a delegation with no reason is rejected (dual audit)', async () => {
    const d = makeDelegationHarness();
    await expect(d.delegate('u_boss', { user_id: 'u_deleg', position: 'approver', delegated_from: 'u_boss', valid_until: iso(T0 + 5 * DAY) }))
      .rejects.toThrow(/requires a reason/);
  });

  it('you may only delegate authority you hold yourself (delegated_from must be you)', async () => {
    const d = makeDelegationHarness();
    await expect(d.delegate('u_boss', { user_id: 'u_deleg', position: 'approver', delegated_from: 'u_other', valid_until: iso(T0 + 5 * DAY), reason: 'x' }))
      .rejects.toThrow(/only delegate authority you hold yourself/);
  });

  it('a non-delegatable position cannot be delegated even by a direct holder', async () => {
    const d = makeDelegationHarness();
    await expect(d.delegate('u_boss', { user_id: 'u_deleg', position: 'plain_pos', delegated_from: 'u_boss', valid_until: iso(T0 + 5 * DAY), reason: 'x' }))
      .rejects.toThrow(/not delegatable/);
  });

  it('you cannot delegate a position you do not hold', async () => {
    const d = makeDelegationHarness();
    await expect(d.delegate('u_boss', { user_id: 'u_deleg', position: 'spare_pos', delegated_from: 'u_boss', valid_until: iso(T0 + 5 * DAY), reason: 'x' }))
      .rejects.toThrow(/do not currently hold/);
  });

  it('a grant held ONLY via delegation is not re-delegatable (chains are cut)', async () => {
    const d = makeDelegationHarness();
    await expect(d.delegate('u_relay', { user_id: 'u_deleg', position: 'approver', delegated_from: 'u_relay', valid_until: iso(T0 + 5 * DAY), reason: 'x' }))
      .rejects.toThrow(/only via delegation/);
  });

  it('a delegatable position distributing an adminScope set cannot be self-delegated (D12 containment)', async () => {
    const d = makeDelegationHarness();
    await expect(d.delegate('u_boss', { user_id: 'u_deleg', position: 'admin_pos', delegated_from: 'u_boss', valid_until: iso(T0 + 5 * DAY), reason: 'x' }))
      .rejects.toThrow(/administration cannot be self-delegated/);
  });

  it('you cannot delegate a position to yourself', async () => {
    const d = makeDelegationHarness();
    await expect(d.delegate('u_boss', { user_id: 'u_boss', position: 'approver', delegated_from: 'u_boss', valid_until: iso(T0 + 5 * DAY), reason: 'x' }))
      .rejects.toThrow(/to yourself/);
  });

  it('a direct holding that has itself EXPIRED can no longer be delegated (L1 validity threads through)', async () => {
    const d = makeDelegationHarness();
    d.tables.sys_user_position.find((r: any) => r.id === 'h1').valid_until = iso(T0 - DAY); // boss's own approver holding expired
    await expect(d.delegate('u_boss', { user_id: 'u_deleg', position: 'approver', delegated_from: 'u_boss', valid_until: iso(T0 + 5 * DAY), reason: 'x' }))
      .rejects.toThrow(/do not currently hold/);
  });

  it('a plain assignment (no delegated_from) by the same non-admin still fails closed — the branch triggers only on delegation', async () => {
    const d = makeDelegationHarness();
    await expect(d.delegate('u_boss', { user_id: 'u_deleg', position: 'approver', business_unit_id: 'bu_x' }))
      .rejects.toThrow(/delegated adminScope/);
  });

  it('delegating an audience anchor is rejected by the anchor invariant before delegation rules', async () => {
    const d = makeDelegationHarness();
    await expect(d.delegate('u_boss', { user_id: 'u_deleg', position: 'everyone', delegated_from: 'u_boss', valid_until: iso(T0 + 5 * DAY), reason: 'x' }))
      .rejects.toThrow(/audience anchor/);
  });
});
