// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
// ADR-0090 D3 — positions are FLAT: expansion resolves holders from the
// platform assignment table ∪ the better-auth membership transition source.
// The former hierarchy walk (descendant positions) was retired with the tree.

import { describe, it, expect } from 'vitest';
import { PositionGraphService } from './position-graph.js';

// Minimal engine: resolves find('sys_user_position') and find('sys_member').
function makeEngine(
  assignments: Array<{ position: string; user_id: string; organization_id?: string | null }>,
  members: Array<{ role: string; user_id: string }>,
) {
  return {
    async find(object: string, options: any) {
      const f = options?.filter ?? options?.where ?? {};
      if (object === 'sys_user_position') {
        return assignments.filter(
          (a) =>
            (f.position === undefined || a.position === f.position) &&
            (f.organization_id === undefined || a.organization_id === f.organization_id),
        );
      }
      if (object === 'sys_member') return members.filter((m) => f.role === undefined || m.role === f.role);
      return [];
    },
  } as any;
}

const ASSIGNMENTS = [
  { position: 'sales_manager', user_id: 'u_mgr' },
  { position: 'sales_rep', user_id: 'u_rep1' },
  { position: 'sales_rep', user_id: 'u_rep2' },
];
const MEMBERS = [
  { role: 'sales_rep', user_id: 'u_legacy_rep' }, // better-auth transition source
  { role: 'exec', user_id: 'u_exec' },
];

describe('PositionGraphService (ADR-0090 D3 — flat expansion)', () => {
  it('expands holders from the platform assignment table', async () => {
    const g = new PositionGraphService({ engine: makeEngine(ASSIGNMENTS, []) });
    expect((await g.expandPositionUsers('sales_rep')).sort()).toEqual(['u_rep1', 'u_rep2']);
    expect(await g.expandPositionUsers('sales_manager')).toEqual(['u_mgr']);
  });

  it('unions the better-auth membership transition source (no duplicates)', async () => {
    const g = new PositionGraphService({
      engine: makeEngine([...ASSIGNMENTS, { position: 'sales_rep', user_id: 'u_legacy_rep' }], MEMBERS),
    });
    const users = (await g.expandPositionUsers('sales_rep')).sort();
    expect(users).toEqual(['u_legacy_rep', 'u_rep1', 'u_rep2']);
  });

  it('membership-only holders still resolve (transition window)', async () => {
    const g = new PositionGraphService({ engine: makeEngine([], MEMBERS) });
    expect(await g.expandPositionUsers('exec')).toEqual(['u_exec']);
  });

  it('unknown position / empty name → empty', async () => {
    const g = new PositionGraphService({ engine: makeEngine(ASSIGNMENTS, MEMBERS) });
    expect(await g.expandPositionUsers('nope')).toEqual([]);
    expect(await g.expandPositionUsers('')).toEqual([]);
  });

  it('caches per (org, position) within a pass', async () => {
    let calls = 0;
    const engine = {
      async find(object: string, options: any) {
        calls++;
        if (object === 'sys_user_position') return [{ position: 'p', user_id: 'u1' }];
        return [];
      },
    } as any;
    const g = new PositionGraphService({ engine });
    await g.expandPositionUsers('p');
    const before = calls;
    await g.expandPositionUsers('p');
    expect(calls).toBe(before); // second hit served from cache
  });
});
