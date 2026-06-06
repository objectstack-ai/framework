// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.
//
// Roll-up `summary` fields: a parent field whose value is an aggregate over a
// child collection (SUM/COUNT/...). The engine must recompute it whenever a
// child record is inserted / updated / deleted.

import { describe, it, expect, beforeEach } from 'vitest';
import { ObjectQL } from './engine.js';

function makeDriver() {
  const stores = new Map<string, Map<string, any>>();
  const storeFor = (o: string) => {
    let s = stores.get(o);
    if (!s) { s = new Map(); stores.set(o, s); }
    return s;
  };
  const matches = (row: any, where: any): boolean => {
    if (!where || typeof where !== 'object') return true;
    return Object.entries(where).every(([k, v]) => row?.[k] === v);
  };
  let n = 0;
  const driver: any = {
    name: 'memory', version: '0.0.0', supports: {},
    async connect() {}, async disconnect() {}, async checkHealth() { return true; }, async execute() { return null; },
    async find(object: string, ast: any) {
      return Array.from(storeFor(object).values()).filter((r) => matches(r, ast?.where));
    },
    findStream() { throw new Error('ni'); },
    async findOne(object: string, ast: any) {
      for (const r of storeFor(object).values()) if (matches(r, ast?.where)) return r;
      return null;
    },
    async create(object: string, data: Record<string, unknown>) {
      n += 1;
      const id = (data.id as string) ?? `r_${n}`;
      const row = { ...data, id };
      storeFor(object).set(id, row);
      return row;
    },
    async update(object: string, id: string, data: Record<string, unknown>) {
      const s = storeFor(object);
      const row = { ...s.get(id), ...data, id };
      s.set(id, row);
      return row;
    },
    async delete(object: string, id: string) { return storeFor(object).delete(id); },
    async count() { return 0; },
    async bulkCreate(object: string, rows: Record<string, unknown>[]) {
      return Promise.all(rows.map((r) => this.create(object, r, undefined)));
    },
    async bulkUpdate() { return []; }, async bulkDelete() {},
    async beginTransaction() { return { __trx: true, commit: async () => {}, rollback: async () => {} }; },
    async commit() {}, async rollback() {},
  };
  return { driver, storeFor };
}

describe('roll-up summary fields', () => {
  let engine: ObjectQL;
  let storeFor: ReturnType<typeof makeDriver>['storeFor'];

  beforeEach(async () => {
    engine = new ObjectQL();
    const d = makeDriver();
    storeFor = d.storeFor;
    engine.registerDriver(d.driver, true);
    await engine.init();
    engine.registry.registerObject({
      name: 'inv',
      fields: {
        name: { type: 'text' },
        line_total: { type: 'summary', summaryOperations: { object: 'inv_line', field: 'amount', function: 'sum' } },
        line_count: { type: 'summary', summaryOperations: { object: 'inv_line', field: 'amount', function: 'count' } },
      },
    } as any);
    engine.registry.registerObject({
      name: 'inv_line',
      fields: {
        amount: { type: 'number' },
        inv: { type: 'master_detail', reference: 'inv' },
      },
    } as any);
  });

  const parent = (id: string) => storeFor('inv').get(id);

  it('computes SUM and COUNT on the parent as children are inserted', async () => {
    const p = await engine.insert('inv', { name: 'INV-1' });
    await engine.insert('inv_line', { inv: p.id, amount: 10 });
    await engine.insert('inv_line', { inv: p.id, amount: 32 });

    expect(parent(p.id).line_total).toBe(42);
    expect(parent(p.id).line_count).toBe(2);
  });

  it('recomputes when a child amount is updated', async () => {
    const p = await engine.insert('inv', { name: 'INV-2' });
    const l1 = await engine.insert('inv_line', { inv: p.id, amount: 10 });
    await engine.insert('inv_line', { inv: p.id, amount: 5 });
    expect(parent(p.id).line_total).toBe(15);

    await engine.update('inv_line', { id: l1.id, amount: 100 });
    expect(parent(p.id).line_total).toBe(105);
  });

  it('recomputes when a child is deleted (down to 0 with no children)', async () => {
    const p = await engine.insert('inv', { name: 'INV-3' });
    const l1 = await engine.insert('inv_line', { inv: p.id, amount: 10 });
    expect(parent(p.id).line_total).toBe(10);

    await engine.delete('inv_line', { where: { id: l1.id } });
    expect(parent(p.id).line_total).toBe(0);
    expect(parent(p.id).line_count).toBe(0);
  });

  it('only recomputes the affected parent', async () => {
    const a = await engine.insert('inv', { name: 'A' });
    const b = await engine.insert('inv', { name: 'B' });
    await engine.insert('inv_line', { inv: a.id, amount: 7 });
    await engine.insert('inv_line', { inv: b.id, amount: 3 });

    expect(parent(a.id).line_total).toBe(7);
    expect(parent(b.id).line_total).toBe(3);
  });
});
