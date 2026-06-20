// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
// ADR-0056 D6 — role-hierarchy graph powering the `role_and_subordinates` recipient.

import { describe, it, expect } from 'vitest';
import { RoleGraphService } from './role-graph.js';

// Minimal engine: resolves find('sys_role', {parent}) and find('sys_member', {role}).
function makeEngine(roles: Array<{ name: string; parent?: string | null }>, members: Array<{ role: string; user_id: string }>) {
  return {
    async find(object: string, options: any) {
      const f = options?.filter ?? options?.where ?? {};
      if (object === 'sys_role') return roles.filter(r => (f.parent === undefined || r.parent === f.parent));
      if (object === 'sys_member') return members.filter(m => (f.role === undefined || m.role === f.role));
      return [];
    },
  } as any;
}

const ROLES = [
  { name: 'ceo', parent: null },
  { name: 'vp', parent: 'ceo' },
  { name: 'rep', parent: 'vp' },
  { name: 'rep2', parent: 'vp' },
];
const MEMBERS = [
  { role: 'ceo', user_id: 'u_ceo' },
  { role: 'vp', user_id: 'u_vp' },
  { role: 'rep', user_id: 'u_rep' },
  { role: 'rep2', user_id: 'u_rep2' },
];

describe('RoleGraphService (ADR-0056 D6)', () => {
  it('descendantRoles walks the hierarchy downward (incl. self)', async () => {
    const g = new RoleGraphService({ engine: makeEngine(ROLES, MEMBERS) });
    expect((await g.descendantRoles('ceo')).sort()).toEqual(['ceo', 'rep', 'rep2', 'vp']);
    expect((await g.descendantRoles('vp')).sort()).toEqual(['rep', 'rep2', 'vp']);
    expect(await g.descendantRoles('rep')).toEqual(['rep']);
  });

  it('expandRoleAndSubordinates returns the role + all subordinate users', async () => {
    const g = new RoleGraphService({ engine: makeEngine(ROLES, MEMBERS) });
    expect((await g.expandRoleAndSubordinates('ceo')).sort()).toEqual(['u_ceo', 'u_rep', 'u_rep2', 'u_vp']);
    expect((await g.expandRoleAndSubordinates('vp')).sort()).toEqual(['u_rep', 'u_rep2', 'u_vp']);
    expect(await g.expandRoleAndSubordinates('rep')).toEqual(['u_rep']);
  });

  it('is cycle-safe (A↔B parent loop terminates)', async () => {
    const cyclic = [{ name: 'a', parent: 'b' }, { name: 'b', parent: 'a' }];
    const g = new RoleGraphService({ engine: makeEngine(cyclic, [{ role: 'a', user_id: 'ua' }, { role: 'b', user_id: 'ub' }]) });
    const d = (await g.descendantRoles('a')).sort();
    expect(d).toEqual(['a', 'b']);
    expect((await g.expandRoleAndSubordinates('a')).sort()).toEqual(['ua', 'ub']);
  });

  it('unknown role → empty', async () => {
    const g = new RoleGraphService({ engine: makeEngine(ROLES, MEMBERS) });
    expect(await g.expandRoleAndSubordinates('nope')).toEqual([]);
    expect(await g.expandRoleAndSubordinates('')).toEqual([]);
  });
});
