// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Deprecation window for non-canonical `config` keys on the CRUD nodes.
 *
 * Two aliases, now handled at two different layers:
 *  - `object` → `objectName` is still tolerated by the **executor** shim
 *    (`readAliasedConfig`), warning once per alias. See config-aliases.ts.
 *  - `filters` → `filter` has been **retired from the executor** and promoted
 *    into the ADR-0087 D2 conversion layer (`@objectstack/spec` conversion
 *    `flow-node-crud-filter-alias`): it is rewritten to `filter` at load, so a
 *    raw `filters` key reaching the executor directly (a flow that skipped the
 *    load seam) is no longer honored, and the executor emits no alias warning
 *    for it. This test documents that split — the PD #12 retirement path.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeStackInput } from '@objectstack/spec';
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

describe('CRUD config-key aliases: object→objectName (executor shim) + filters→filter (retired to load-time conversion)', () => {
  beforeEach(() => __resetAliasDeprecationWarnings());

  it('still resolves the deprecated `object` alias at runtime, warning once', async () => {
    const engine = new AutomationEngine(silentLogger());
    const { data, calls } = fakeData();
    const warns: string[] = [];
    registerCrudNodes(engine, ctxWith(data, collectingLogger(warns)));

    // Canonical `filter`; deprecated `object`.
    engine.registerFlow('gr', getRecordFlow({ object: 'crm_lead', filter: { id: 'L1' }, outputVariable: 'lead' }));
    const res = await engine.execute('gr');

    expect(res.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].obj).toBe('crm_lead');
    expect(calls[0].opts.where).toEqual({ id: 'L1' });

    const objectWarn = warns.find((w) => w.includes("'object'") && w.includes("'objectName'"));
    expect(objectWarn).toBeTruthy();

    // One-time per alias: a second run does not warn again.
    const before = warns.length;
    await engine.execute('gr');
    expect(warns.length).toBe(before);
  });

  it('no longer honors a raw `filters` alias in the executor (retired to the D2 conversion layer)', async () => {
    const engine = new AutomationEngine(silentLogger());
    const { data, calls } = fakeData();
    const warns: string[] = [];
    registerCrudNodes(engine, ctxWith(data, collectingLogger(warns)));

    // A flow that reached the executor WITHOUT going through the load conversion
    // still carries `filters`. The executor now reads only the canonical `filter`,
    // so `filters` is ignored and no `filters`→`filter` warning is emitted here.
    engine.registerFlow('gr', getRecordFlow({ objectName: 'crm_lead', filters: { id: 'L1' } }));
    await engine.execute('gr');

    expect(calls[0].opts.where).toEqual({}); // `filters` no longer honored by the executor
    const filterWarn = warns.find((w) => w.includes("'filters'"));
    expect(filterWarn).toBeFalsy();
  });

  it('the D2 conversion at load rewrites `filters` → `filter` so the flow works end-to-end', async () => {
    const engine = new AutomationEngine(silentLogger());
    const { data, calls } = fakeData();
    registerCrudNodes(engine, ctxWith(data, silentLogger()));

    // Author with the deprecated `filters` key, then run it through the same load
    // seam a real stack load uses. The conversion canonicalizes it to `filter`.
    const raw = getRecordFlow({ objectName: 'crm_lead', filters: { id: 'L1' }, outputVariable: 'lead' });
    const converted = (normalizeStackInput({ flows: [raw] }).flows as any[])[0];
    engine.registerFlow('gr', converted);
    await engine.execute('gr');

    expect(calls[0].opts.where).toEqual({ id: 'L1' });
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
