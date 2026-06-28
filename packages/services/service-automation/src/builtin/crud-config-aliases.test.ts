// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Deprecation window for non-canonical `config` keys on the CRUD nodes
 * (`object` → `objectName`, `filters` → `filter`). The alias keeps working so
 * already-stored flows keep running, but emits a one-time `logger.warn` steering
 * the author to the canonical key. See config-aliases.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AutomationEngine } from '../engine.js';
import { registerCrudNodes } from './crud-nodes.js';
import { __resetAliasDeprecationWarnings } from './config-aliases.js';

function silentLogger(): any {
  const l: any = { info() {}, warn() {}, error() {}, debug() {} };
  l.child = () => l;
  return l;
}

function collectingLogger(warns: string[]): any {
  const l: any = { info() {}, warn(m: string) { warns.push(m); }, error() {}, debug() {} };
  l.child = () => l;
  return l;
}

function fakeData() {
  const calls: Array<{ op: string; obj: string; opts?: any }> = [];
  const data: any = {
    async find(obj: string, opts: any) { calls.push({ op: 'find', obj, opts }); return [{ id: 'r1' }]; },
    async findOne(obj: string, opts: any) { calls.push({ op: 'findOne', obj, opts }); return { id: 'r1' }; },
    async insert(obj: string, fields: any) { calls.push({ op: 'insert', obj, opts: { fields } }); return { id: `${obj}_1`, ...fields }; },
    async update(obj: string, fields: any, opts: any) { calls.push({ op: 'update', obj, opts: { ...opts, fields } }); return { ok: true }; },
    async delete(obj: string, opts: any) { calls.push({ op: 'delete', obj, opts }); return { ok: true }; },
  };
  return { data, calls };
}

const ctxWith = (data: any, logger: any): any => ({
  logger,
  getService: (n: string) => (n === 'data' ? data : undefined),
});

function getRecordFlow(config: Record<string, unknown>) {
  return {
    name: 'gr', label: 'G', type: 'autolaunched',
    nodes: [
      { id: 'start', type: 'start', label: 'Start' },
      { id: 'g', type: 'get_record', label: 'Get', config },
      { id: 'end', type: 'end', label: 'End' },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'g' },
      { id: 'e2', source: 'g', target: 'end' },
    ],
  } as any;
}

describe('CRUD config-key alias deprecation (object→objectName, filters→filter)', () => {
  beforeEach(() => __resetAliasDeprecationWarnings());

  it('still resolves the deprecated `object` + `filters` aliases at runtime', async () => {
    const engine = new AutomationEngine(silentLogger());
    const { data, calls } = fakeData();
    const warns: string[] = [];
    registerCrudNodes(engine, ctxWith(data, collectingLogger(warns)));

    engine.registerFlow('gr', getRecordFlow({ object: 'crm_lead', filters: { id: 'L1' }, outputVariable: 'lead' }));
    const res = await engine.execute('gr');

    expect(res.success).toBe(true);
    // The alias values reached the data engine unchanged.
    expect(calls).toHaveLength(1);
    expect(calls[0].obj).toBe('crm_lead');
    expect(calls[0].opts.where).toEqual({ id: 'L1' });
  });

  it('warns once per alias, naming the canonical key', async () => {
    const engine = new AutomationEngine(silentLogger());
    const { data } = fakeData();
    const warns: string[] = [];
    registerCrudNodes(engine, ctxWith(data, collectingLogger(warns)));

    engine.registerFlow('gr', getRecordFlow({ object: 'crm_lead', filters: { id: 'L1' } }));
    await engine.execute('gr');

    const objectWarn = warns.find((w) => w.includes("'object'") && w.includes("'objectName'"));
    const filterWarn = warns.find((w) => w.includes("'filters'") && w.includes("'filter'"));
    expect(objectWarn).toBeTruthy();
    expect(filterWarn).toBeTruthy();

    // Second run in the same process must NOT warn again (one-time per alias).
    const before = warns.length;
    await engine.execute('gr');
    expect(warns.length).toBe(before);
  });

  it('does NOT warn when the canonical keys are used', async () => {
    const engine = new AutomationEngine(silentLogger());
    const { data } = fakeData();
    const warns: string[] = [];
    registerCrudNodes(engine, ctxWith(data, collectingLogger(warns)));

    engine.registerFlow('gr', getRecordFlow({ objectName: 'crm_lead', filter: { id: 'L1' }, outputVariable: 'lead' }));
    const res = await engine.execute('gr');

    expect(res.success).toBe(true);
    expect(warns).toHaveLength(0);
  });
});
