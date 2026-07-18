// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// #3043 — static `readonly: true` fields must not be SEEDABLE via a non-system
// create through the external data API. The strip lives at the DataProtocol
// ingress (createData / createManyData / batchData / cloneData) — the seam every
// external REST/GraphQL/MCP create funnels through — while trusted internal
// writers call engine.insert directly and are unaffected. It runs BEFORE
// engine.insert, so a stripped field falls back to its defaultValue (re-derived
// by the engine, which the mock stands in for). System context is exempt.

import { describe, it, expect, vi } from 'vitest';
import { ObjectStackProtocolImplementation } from './protocol.js';

const SCHEMA = {
  name: 'approval_case',
  fields: {
    title: { name: 'title', type: 'text' },
    // readonly approval column — the #3003 attack target
    approval_status: { name: 'approval_status', type: 'text', readonly: true, defaultValue: 'draft' },
    // readonly provenance stamp with no default
    source: { name: 'source', type: 'text', readonly: true },
  },
};

function makeProtocol() {
  const inserts: Array<{ object: string; data: any; options: any }> = [];
  const engine = {
    registry: { getObject: (n: string) => (n === 'approval_case' ? SCHEMA : undefined) },
    insert: vi.fn(async (object: string, data: any, options?: any) => {
      inserts.push({ object, data, options });
      const rows = Array.isArray(data) ? data : [data];
      const out = rows.map((r, i) => ({ id: `rec-${i + 1}`, ...r }));
      return Array.isArray(data) ? out : out[0];
    }),
  };
  const p = new ObjectStackProtocolImplementation(engine as any);
  return { p, engine, inserts };
}

describe('createData — static readonly INSERT strip (#3043)', () => {
  it('drops a non-system caller forging a readonly field; editable sibling lands', async () => {
    const { p, inserts } = makeProtocol();
    await p.createData({
      object: 'approval_case',
      data: { title: 'Case A', approval_status: 'approved' },
      context: { userId: 'u1' },
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].data).toEqual({ title: 'Case A' }); // approval_status stripped
    expect(inserts[0].data).not.toHaveProperty('approval_status');
  });

  it('ALLOWS a system-context caller to seed the readonly field', async () => {
    const { p, inserts } = makeProtocol();
    await p.createData({
      object: 'approval_case',
      data: { title: 'Seed', approval_status: 'approved' },
      context: { isSystem: true },
    });
    expect(inserts[0].data.approval_status).toBe('approved');
  });

  it('strips a forged readonly field even when no context is supplied (non-system default)', async () => {
    const { p, inserts } = makeProtocol();
    await p.createData({ object: 'approval_case', data: { title: 'X', source: 'attacker' } });
    expect(inserts[0].data).not.toHaveProperty('source');
  });

  it('does NOT strip a PLATFORM object — defers to its own field guards (ADR-0086 / #3004)', async () => {
    // A `sys_`/managedBy object carries dedicated write governance (e.g. the
    // ADR-0086 provenance guard REJECTS a forged managed_by/package_id with 403);
    // the generic silent strip must not pre-empt that. Proven with both markers.
    const platformSchema = {
      name: 'sys_permission_set',
      fields: { managed_by: { name: 'managed_by', type: 'select', readonly: true } },
    };
    const managedSchema = {
      name: 'crm_thing', managedBy: 'package',
      fields: { locked: { name: 'locked', type: 'text', readonly: true } },
    };
    const inserts: any[] = [];
    const engine = {
      registry: { getObject: (n: string) => (n === 'sys_permission_set' ? platformSchema : managedSchema) },
      insert: vi.fn(async (object: string, data: any) => { inserts.push({ object, data }); return { id: 'x', ...data }; }),
    };
    const p = new ObjectStackProtocolImplementation(engine as any);
    await p.createData({ object: 'sys_permission_set', data: { managed_by: 'package' }, context: { userId: 'u1' } });
    await p.createData({ object: 'crm_thing', data: { locked: 'forged' }, context: { userId: 'u1' } });
    expect(inserts[0].data.managed_by, 'sys_ object: readonly field passed through to its guard').toBe('package');
    expect(inserts[1].data.locked, 'managedBy object: readonly field passed through to its guard').toBe('forged');
  });
});

describe('createManyData / batchData — per-row readonly INSERT strip (#3043)', () => {
  it('createManyData strips the forged readonly column on every row', async () => {
    const { p, inserts } = makeProtocol();
    await p.createManyData({
      object: 'approval_case',
      records: [
        { title: 'A', approval_status: 'approved' },
        { title: 'B', approval_status: 'approved' },
      ],
      context: { userId: 'u1' },
    });
    expect(inserts[0].data).toEqual([{ title: 'A' }, { title: 'B' }]);
  });

  it('batchData create strips the forged readonly column', async () => {
    const { p, inserts } = makeProtocol();
    await p.batchData({
      object: 'approval_case',
      request: { operation: 'create', records: [{ data: { title: 'A', approval_status: 'approved' } }] } as any,
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].data).toEqual({ title: 'A' });
  });
});
