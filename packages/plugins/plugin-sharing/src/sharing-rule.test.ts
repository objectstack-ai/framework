// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';
import { SharingService } from './sharing-service.js';
import { SharingRuleService } from './sharing-rule-service.js';
import { TeamGraphService } from './team-graph.js';

interface Row { [k: string]: any }

function makeEngine() {
  const tables: Record<string, Row[]> = {};
  const ensure = (n: string) => (tables[n] ??= []);
  function matches(row: Row, f: any): boolean {
    if (!f || typeof f !== 'object') return true;
    if (Array.isArray(f.$or)) return f.$or.some((x: any) => matches(row, x));
    if (Array.isArray(f.$and)) return f.$and.every((x: any) => matches(row, x));
    for (const [k, v] of Object.entries(f)) {
      if (k === '$or' || k === '$and') continue;
      const rv = row[k];
      if (v != null && typeof v === 'object' && '$in' in (v as any)) {
        if (!(v as any).$in.includes(rv)) return false;
        continue;
      }
      if (v != null && typeof v === 'object' && '$gte' in (v as any)) {
        if (!(rv >= (v as any).$gte)) return false;
        continue;
      }
      if (rv !== v) return false;
    }
    return true;
  }
  return {
    _tables: tables,
    getSchema() { return undefined; },
    async find(o: string, opts?: any) {
      const f = opts?.filter ?? opts?.where;
      return ensure(o).filter(r => matches(r, f)).slice(0, opts?.limit ?? 10000);
    },
    async insert(o: string, data: any) { const row = { ...data }; ensure(o).push(row); return row; },
    async update(o: string, idOrData: any, dataOrOpts?: any) {
      const data = typeof idOrData === 'object' ? idOrData : dataOrOpts;
      const id = typeof idOrData === 'object' ? idOrData.id : idOrData;
      const t = ensure(o); const i = t.findIndex(r => r.id === id);
      if (i >= 0) t[i] = { ...t[i], ...data };
      return t[i];
    },
    async delete(o: string, opts?: any) {
      const t = ensure(o); const where = opts?.where ?? {};
      for (let i = t.length - 1; i >= 0; i--) if (matches(t[i], where)) t.splice(i, 1);
      return { ok: true };
    },
  };
}

describe('TeamGraphService', () => {
  let engine: ReturnType<typeof makeEngine>;
  beforeEach(() => {
    engine = makeEngine();
    // Hierarchy: root → eu → eu_sales; root → us
    engine._tables.sys_team = [
      { id: 'root', name: 'root', parent_team_id: null, organization_id: 'org1' },
      { id: 'eu', name: 'eu', parent_team_id: 'root', organization_id: 'org1' },
      { id: 'eu_sales', name: 'eu_sales', parent_team_id: 'eu', organization_id: 'org1' },
      { id: 'us', name: 'us', parent_team_id: 'root', organization_id: 'org1' },
      // foreign org sibling — must NOT leak
      { id: 'foreign', name: 'foreign', parent_team_id: 'root', organization_id: 'org2' },
    ];
    engine._tables.sys_team_member = [
      { id: 'tm1', team_id: 'eu_sales', user_id: 'alice' },
      { id: 'tm2', team_id: 'eu', user_id: 'bob' },
      { id: 'tm3', team_id: 'us', user_id: 'carol' },
    ];
    engine._tables.sys_member = [
      { id: 'm1', organization_id: 'org1', user_id: 'alice', role: 'sales_manager' },
      { id: 'm2', organization_id: 'org1', user_id: 'bob',   role: 'sales_rep' },
      { id: 'm3', organization_id: 'org2', user_id: 'eve',   role: 'sales_manager' },
    ];
    engine._tables.sys_user = [
      { id: 'alice', manager_id: 'bob' },
      { id: 'bob',   manager_id: 'carol' },
      { id: 'carol', manager_id: null },
    ];
  });

  it('descendants walks the hierarchy', async () => {
    const g = new TeamGraphService({ engine: engine as any, organizationId: 'org1' });
    const d = await g.descendants('root');
    expect(d.sort()).toEqual(['eu', 'eu_sales', 'root', 'us']);
  });

  it('expandUsers returns members of all descendants', async () => {
    const g = new TeamGraphService({ engine: engine as any, organizationId: 'org1' });
    const users = await g.expandUsers('root');
    expect(users.sort()).toEqual(['alice', 'bob', 'carol']);
  });

  it('expandUsers of leaf returns just leaf members', async () => {
    const g = new TeamGraphService({ engine: engine as any, organizationId: 'org1' });
    expect(await g.expandUsers('eu_sales')).toEqual(['alice']);
  });

  it('expandRoleUsers scopes by organization', async () => {
    const g = new TeamGraphService({ engine: engine as any, organizationId: 'org1' });
    expect((await g.expandRoleUsers('sales_manager')).sort()).toEqual(['alice']);
  });

  it('managerOf walks chain', async () => {
    const g = new TeamGraphService({ engine: engine as any, organizationId: 'org1' });
    expect(await g.managerOf('alice')).toEqual('bob');
    expect(await g.managerOf('carol')).toBeNull();
  });

  it('expandPrincipal dispatches correctly', async () => {
    const g = new TeamGraphService({ engine: engine as any, organizationId: 'org1' });
    expect(await g.expandPrincipal({ type: 'user', value: 'x' })).toEqual(['x']);
    expect((await g.expandPrincipal({ type: 'team', value: 'eu_sales' })).sort()).toEqual(['alice']);
    expect((await g.expandPrincipal({ type: 'role', value: 'sales_manager' })).sort()).toEqual(['alice']);
    expect(await g.expandPrincipal({ type: 'manager', value: 'owner_id', record: { owner_id: 'alice' } })).toEqual(['bob']);
    expect(await g.expandPrincipal({ type: 'queue', value: 'q1' })).toEqual(['queue:q1']);
  });
});

describe('SharingRuleService', () => {
  let engine: ReturnType<typeof makeEngine>;
  let sharing: SharingService;
  let rules: SharingRuleService;
  const SYS = { isSystem: true, organizationId: 'org1' } as any;

  beforeEach(() => {
    engine = makeEngine();
    // Seed: 3 opportunities — 2 high-value, 1 low.
    engine._tables.opportunity = [
      { id: 'opp1', name: 'Big1', amount: 200000, owner_id: 'someone' },
      { id: 'opp2', name: 'Big2', amount: 150000, owner_id: 'someone' },
      { id: 'opp3', name: 'Small', amount: 5000, owner_id: 'someone' },
    ];
    engine._tables.sys_team = [
      { id: 'sales', name: 'sales', parent_team_id: null, organization_id: 'org1' },
    ];
    engine._tables.sys_team_member = [
      { id: 'tm1', team_id: 'sales', user_id: 'alice' },
      { id: 'tm2', team_id: 'sales', user_id: 'bob' },
    ];
    sharing = new SharingService({ engine: engine as any });
    rules = new SharingRuleService({ engine: engine as any, sharing });
  });

  it('defineRule creates a new rule', async () => {
    const r = await rules.defineRule({
      name: 'high_value', label: 'High value', object: 'opportunity',
      criteria: { amount: { $gte: 100000 } },
      recipientType: 'team', recipientId: 'sales', accessLevel: 'read',
    }, SYS);
    expect(r.id).toBeDefined();
    expect(r.criteria).toEqual({ amount: { $gte: 100000 } });
    expect(engine._tables.sys_sharing_rule).toHaveLength(1);
  });

  it('defineRule upserts on duplicate name within org', async () => {
    await rules.defineRule({ name: 'x', label: 'X', object: 'opportunity', recipientType: 'user', recipientId: 'a' }, SYS);
    await rules.defineRule({ name: 'x', label: 'X-renamed', object: 'opportunity', recipientType: 'user', recipientId: 'b' }, SYS);
    expect(engine._tables.sys_sharing_rule).toHaveLength(1);
    expect(engine._tables.sys_sharing_rule[0].label).toBe('X-renamed');
    expect(engine._tables.sys_sharing_rule[0].recipient_id).toBe('b');
  });

  it('evaluateRule materialises grants for matching records × expanded users', async () => {
    const r = await rules.defineRule({
      name: 'hv', label: 'High value', object: 'opportunity',
      criteria: { amount: { $gte: 100000 } },
      recipientType: 'team', recipientId: 'sales', accessLevel: 'read',
    }, SYS);
    const res = await rules.evaluateRule(r.id, SYS);
    expect(res.matchedRecords).toBe(2);
    expect(res.expandedUsers).toBe(2);
    expect(res.grantsCreated).toBe(4); // 2 records × 2 users
    expect(engine._tables.sys_record_share).toHaveLength(4);
    // Verify shape
    const shares = engine._tables.sys_record_share;
    expect(new Set(shares.map(s => s.record_id))).toEqual(new Set(['opp1', 'opp2']));
    expect(new Set(shares.map(s => s.recipient_id))).toEqual(new Set(['alice', 'bob']));
    expect(shares.every(s => s.source === 'rule' && s.source_id === r.id && s.access_level === 'read')).toBe(true);
  });

  it('evaluateRule reconciles — re-running with a narrower criteria revokes stale grants', async () => {
    const r = await rules.defineRule({
      name: 'hv', label: 'HV', object: 'opportunity',
      criteria: { amount: { $gte: 100000 } },
      recipientType: 'team', recipientId: 'sales',
    }, SYS);
    await rules.evaluateRule(r.id, SYS);
    expect(engine._tables.sys_record_share).toHaveLength(4);

    // Tighten criteria — now only opp1 (200k) qualifies.
    await rules.defineRule({
      name: 'hv', label: 'HV', object: 'opportunity',
      criteria: { amount: { $gte: 175000 } },
      recipientType: 'team', recipientId: 'sales',
    }, SYS);
    const res = await rules.evaluateRule(r.id, SYS);
    expect(res.matchedRecords).toBe(1);
    expect(res.grantsRevoked).toBe(2);
    expect(engine._tables.sys_record_share).toHaveLength(2);
    expect(engine._tables.sys_record_share.every(s => s.record_id === 'opp1')).toBe(true);
  });

  it('evaluateAllForRecord upserts when record newly matches', async () => {
    const r = await rules.defineRule({
      name: 'hv', label: 'HV', object: 'opportunity',
      criteria: { amount: { $gte: 100000 } },
      recipientType: 'team', recipientId: 'sales',
    }, SYS);
    const res = await rules.evaluateAllForRecord('opportunity', 'opp1', SYS);
    expect(res[0].matchedRecords).toBe(1);
    expect(res[0].grantsCreated).toBe(2);
    expect(engine._tables.sys_record_share).toHaveLength(2);
  });

  it('evaluateAllForRecord revokes when record no longer matches', async () => {
    const r = await rules.defineRule({
      name: 'hv', label: 'HV', object: 'opportunity',
      criteria: { amount: { $gte: 100000 } },
      recipientType: 'team', recipientId: 'sales',
    }, SYS);
    await rules.evaluateRule(r.id, SYS);
    // Drop opp1 below threshold
    engine._tables.opportunity[0].amount = 5;
    const res = await rules.evaluateAllForRecord('opportunity', 'opp1', SYS);
    expect(res[0].grantsRevoked).toBe(2);
    // Only opp2 grants remain
    expect(engine._tables.sys_record_share.every(s => s.record_id === 'opp2')).toBe(true);
  });

  it('deleteRule drops rule + all its grants', async () => {
    const r = await rules.defineRule({
      name: 'hv', label: 'HV', object: 'opportunity',
      criteria: { amount: { $gte: 100000 } },
      recipientType: 'team', recipientId: 'sales',
    }, SYS);
    await rules.evaluateRule(r.id, SYS);
    expect(engine._tables.sys_record_share.length).toBeGreaterThan(0);
    await rules.deleteRule(r.id, SYS);
    expect(engine._tables.sys_sharing_rule).toHaveLength(0);
    expect(engine._tables.sys_record_share).toHaveLength(0);
  });

  it('inactive rule purges grants on evaluate', async () => {
    const r = await rules.defineRule({
      name: 'hv', label: 'HV', object: 'opportunity',
      criteria: { amount: { $gte: 100000 } },
      recipientType: 'team', recipientId: 'sales',
    }, SYS);
    await rules.evaluateRule(r.id, SYS);
    expect(engine._tables.sys_record_share).toHaveLength(4);
    await rules.defineRule({
      name: 'hv', label: 'HV', object: 'opportunity',
      criteria: { amount: { $gte: 100000 } },
      recipientType: 'team', recipientId: 'sales', active: false,
    }, SYS);
    const res = await rules.evaluateRule(r.id, SYS);
    expect(res.grantsRevoked).toBe(4);
    expect(engine._tables.sys_record_share).toHaveLength(0);
  });

  it('listRules filters by object + activeOnly', async () => {
    await rules.defineRule({ name: 'a', label: 'A', object: 'opportunity', recipientType: 'user', recipientId: 'x' }, SYS);
    await rules.defineRule({ name: 'b', label: 'B', object: 'account',     recipientType: 'user', recipientId: 'y' }, SYS);
    await rules.defineRule({ name: 'c', label: 'C', object: 'opportunity', recipientType: 'user', recipientId: 'z', active: false }, SYS);
    const opps = await rules.listRules({ object: 'opportunity' }, SYS);
    expect(opps).toHaveLength(2);
    const active = await rules.listRules({ object: 'opportunity', activeOnly: true }, SYS);
    expect(active.map(r => r.name)).toEqual(['a']);
  });
});
