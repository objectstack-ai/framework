// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
// #2747 — uninstall-time revocation of a package's data-plane permission rows
// (ADR-0086 D3 provenance consumed at last; ADR-0090 D5 "no ghost grants").

import { describe, it, expect } from 'vitest';
import { cleanupPackagePermissions } from './cleanup-package-permissions';

function makeQl() {
  const tables: Record<string, any[]> = {
    sys_permission_set: [
      // the uninstalled package's own rows
      { id: 'ps_crm_ro', name: 'crm_readonly', package_id: 'com.example.crm', managed_by: 'package' },
      { id: 'ps_crm_admin', name: 'crm_admin', package_id: 'com.example.crm', managed_by: 'package' },
      // another package's row — must survive
      { id: 'ps_other', name: 'other_set', package_id: 'com.other', managed_by: 'package' },
      // env-authored rows — must survive even if a package_id is present
      { id: 'ps_env', name: 'member_default', managed_by: 'user' },
      { id: 'ps_legacy', name: 'admin_full_access' },
    ],
    sys_position_permission_set: [
      { id: 'pps_1', position_id: 'pos_everyone', permission_set_id: 'ps_crm_ro' },
      { id: 'pps_2', position_id: 'pos_sales', permission_set_id: 'ps_crm_admin' },
      { id: 'pps_other', position_id: 'pos_sales', permission_set_id: 'ps_other' },
    ],
    sys_user_permission_set: [
      { id: 'ups_1', user_id: 'u1', permission_set_id: 'ps_crm_admin' },
      { id: 'ups_env', user_id: 'u1', permission_set_id: 'ps_env' },
    ],
    sys_audience_binding_suggestion: [
      { id: 'sug_1', package_id: 'com.example.crm', permission_set_name: 'crm_readonly', anchor: 'everyone', status: 'confirmed' },
      { id: 'sug_2', package_id: 'com.example.crm', permission_set_name: 'crm_admin', anchor: 'everyone', status: 'dismissed' },
      { id: 'sug_other', package_id: 'com.other', permission_set_name: 'other_set', anchor: 'everyone', status: 'pending' },
    ],
  };
  return {
    tables,
    async find(object: string, opts: any) {
      const where = opts?.where ?? {};
      return (tables[object] ?? []).filter((r) =>
        Object.entries(where).every(([k, v]) => (r as any)[k] === v),
      );
    },
    async delete(object: string, opts: any) {
      const id = opts?.where?.id;
      const t = tables[object] ?? [];
      const i = t.findIndex((r) => r.id === id);
      if (i >= 0) t.splice(i, 1);
      return true;
    },
  } as any;
}

describe('cleanupPackagePermissions (#2747)', () => {
  it('removes the package-owned sets, their bindings/grants, and its suggestion rows', async () => {
    const ql = makeQl();
    const out = await cleanupPackagePermissions(ql, 'com.example.crm');

    expect(out).toEqual({ sets: 2, positionBindings: 2, userGrants: 1, suggestions: 2 });

    // no ghost grants: nothing referencing the removed sets survives
    expect(ql.tables.sys_permission_set.map((r: any) => r.id)).toEqual(['ps_other', 'ps_env', 'ps_legacy']);
    expect(ql.tables.sys_position_permission_set.map((r: any) => r.id)).toEqual(['pps_other']);
    expect(ql.tables.sys_user_permission_set.map((r: any) => r.id)).toEqual(['ups_env']);
    expect(ql.tables.sys_audience_binding_suggestion.map((r: any) => r.id)).toEqual(['sug_other']);
  });

  it('never touches env-authored or foreign-package rows (ADR-0086 D4 provenance)', async () => {
    const ql = makeQl();
    await cleanupPackagePermissions(ql, 'com.example.crm');
    const names = ql.tables.sys_permission_set.map((r: any) => r.name);
    expect(names).toContain('other_set');
    expect(names).toContain('member_default');
    expect(names).toContain('admin_full_access');
  });

  it('is idempotent — a second run removes nothing', async () => {
    const ql = makeQl();
    await cleanupPackagePermissions(ql, 'com.example.crm');
    const second = await cleanupPackagePermissions(ql, 'com.example.crm');
    expect(second).toEqual({ sets: 0, positionBindings: 0, userGrants: 0, suggestions: 0 });
  });

  it('no-ops safely on a missing package id or a non-engine handle', async () => {
    expect(await cleanupPackagePermissions(makeQl(), '')).toEqual({ sets: 0, positionBindings: 0, userGrants: 0, suggestions: 0 });
    expect(await cleanupPackagePermissions(null, 'x')).toEqual({ sets: 0, positionBindings: 0, userGrants: 0, suggestions: 0 });
  });
});
