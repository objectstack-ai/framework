// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { bootstrapDeclaredPermissions } from './bootstrap-declared-permissions.js';

/** Minimal in-memory ql + registry for sys_permission_set seeding. */
function makeQl(declared: any[] = []) {
  const rows: any[] = [];
  return {
    rows,
    _registry: { listItems: (type: string) => (type === 'permission' ? declared : []) },
    async find(object: string, q: any) {
      if (object !== 'sys_permission_set') return [];
      const where = q?.where ?? {};
      return rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
    },
    async insert(object: string, data: any) {
      if (object !== 'sys_permission_set') return null;
      rows.push({ ...data });
      return { id: data.id };
    },
    async update(object: string, data: any) {
      if (object !== 'sys_permission_set') return;
      const r = rows.find((x) => x.id === data.id);
      if (r) Object.assign(r, data);
    },
  };
}

const declaredSet = (over: Record<string, any> = {}) => ({
  name: 'crm_sales_rep',
  label: 'Sales Rep',
  objects: { crm_lead: { allowRead: true, allowCreate: true } },
  fields: { 'crm_lead.amount': { readable: true, editable: false } },
  systemPermissions: ['crm.use'],
  _packageId: 'com.example.crm',
  ...over,
});

describe('bootstrapDeclaredPermissions (ADR-0086 D5)', () => {
  it('seeds a declared set as a package-managed sys_permission_set row', async () => {
    const ql = makeQl([declaredSet()]);
    const r = await bootstrapDeclaredPermissions(ql, undefined);
    expect(r.seeded).toBe(1);
    const row = ql.rows[0];
    expect(row.name).toBe('crm_sales_rep');
    expect(row.managed_by).toBe('package');
    expect(row.package_id).toBe('com.example.crm');
    expect(JSON.parse(row.object_permissions)).toEqual({ crm_lead: { allowRead: true, allowCreate: true } });
    expect(JSON.parse(row.field_permissions)).toEqual({ 'crm_lead.amount': { readable: true, editable: false } });
    expect(JSON.parse(row.system_permissions)).toEqual(['crm.use']);
    expect(row.active).toBe(true);
  });

  it('is idempotent + upgrade-aware: re-seeds its OWN row to the shipped declaration', async () => {
    const ql = makeQl([declaredSet()]);
    await bootstrapDeclaredPermissions(ql, undefined);
    // simulate a package upgrade changing the shipped grants
    (ql as any)._registry = {
      listItems: () => [declaredSet({ objects: { crm_lead: { allowRead: true } } })],
    };
    const r2 = await bootstrapDeclaredPermissions(ql, undefined);
    expect(r2.seeded).toBe(0);
    expect(r2.updated).toBe(1);
    expect(ql.rows.length).toBe(1);
    expect(JSON.parse(ql.rows[0].object_permissions)).toEqual({ crm_lead: { allowRead: true } });
  });

  it('never clobbers env-authored rows (platform/user/legacy provenance)', async () => {
    const ql = makeQl([declaredSet({ name: 'member_default' })]);
    // pre-existing row WITHOUT provenance (legacy / bootstrapPlatformAdmin default)
    ql.rows.push({ id: 'ps_legacy', name: 'member_default', object_permissions: '{"x":{"allowRead":true}}' });
    const r = await bootstrapDeclaredPermissions(ql, undefined);
    expect(r.seeded).toBe(0);
    expect(r.updated).toBe(0);
    expect(r.skippedEnvAuthored).toBe(1);
    expect(ql.rows[0].object_permissions).toBe('{"x":{"allowRead":true}}');
    expect(ql.rows[0].managed_by).toBeUndefined();
  });

  it('refuses to write into a row owned by a DIFFERENT package', async () => {
    const ql = makeQl([declaredSet({ _packageId: 'com.example.other' })]);
    ql.rows.push({
      id: 'ps_1', name: 'crm_sales_rep', managed_by: 'package', package_id: 'com.example.crm',
      object_permissions: '{}',
    });
    const warns: any[] = [];
    const r = await bootstrapDeclaredPermissions(ql, undefined, {
      logger: { info: () => {}, warn: (m, meta) => warns.push({ m, meta }) },
    });
    expect(r.skippedForeign).toBe(1);
    expect(ql.rows[0].package_id).toBe('com.example.crm');
    expect(warns.some((w) => String(w.m).includes('owned by another package'))).toBe(true);
  });

  it('skips a declared set with no resolvable owning package (warned, not seeded)', async () => {
    const ql = makeQl([declaredSet({ _packageId: undefined })]);
    const warns: string[] = [];
    const r = await bootstrapDeclaredPermissions(ql, undefined, {
      logger: { info: () => {}, warn: (m) => warns.push(m) },
    });
    expect(r.seeded).toBe(0);
    expect(ql.rows.length).toBe(0);
    expect(warns.some((w) => w.includes('no owning package'))).toBe(true);
  });

  it('falls back to the spec-declared packageId (ADR-0086 D3) when registry provenance is absent', async () => {
    const ql = makeQl([declaredSet({ _packageId: undefined, packageId: 'com.example.declared' })]);
    const r = await bootstrapDeclaredPermissions(ql, undefined);
    expect(r.seeded).toBe(1);
    expect(ql.rows[0].package_id).toBe('com.example.declared');
  });
});
