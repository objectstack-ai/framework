// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * #1873 — a `create_record` node's `outputVariable` must expose the created
 * record so a later node can reference `{var.id}` (and other fields). Before the
 * fix the output variable held only the bare id STRING, so `{var.id}` traversed
 * into a string and resolved to empty.
 */
import { describe, it, expect } from 'vitest';
import { AutomationEngine } from '../engine.js';
import { registerCrudNodes } from './crud-nodes.js';

function makeLogger(): any {
  const l: any = { info() {}, warn() {}, error() {}, debug() {} };
  l.child = () => l;
  return l;
}

function fakeData() {
  const updates: Array<{ obj: string; fields: any; opts: any }> = [];
  const inserts: Array<{ obj: string; fields: any; opts: any }> = [];
  let n = 0;
  const data: any = {
    async insert(obj: string, fields: any, opts: any) { n += 1; inserts.push({ obj, fields, opts }); return { id: `${obj}_${n}`, ...fields }; },
    async update(obj: string, fields: any, opts: any) { updates.push({ obj, fields, opts }); return { ok: true }; },
    async find() { return []; },
    async findOne() { return null; },
  };
  return { data, updates, inserts };
}

const ctxWith = (data: any): any => ({ logger: makeLogger(), getService: (n: string) => (n === 'data' ? data : undefined) });

describe('create_record outputVariable (#1873)', () => {
  it('exposes the created record so {var.id} resolves in a later node', async () => {
    const engine = new AutomationEngine(makeLogger());
    const { data, updates } = fakeData();
    registerCrudNodes(engine, ctxWith(data));

    engine.registerFlow('promote', {
      name: 'promote', label: 'P', type: 'autolaunched',
      nodes: [
        { id: 'start', type: 'start', label: 'Start' },
        { id: 'mk', type: 'create_record', label: 'Create', config: { objectName: 'topic', outputVariable: 'topic', fields: { title: 'X' } } },
        { id: 'upd', type: 'update_record', label: 'Update', config: { objectName: 'signal', filter: { id: 'sig1' }, fields: { promoted_topic: '{topic.id}' } } },
        { id: 'end', type: 'end', label: 'End' },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'mk' },
        { id: 'e2', source: 'mk', target: 'upd' },
        { id: 'e3', source: 'upd', target: 'end' },
      ],
    } as any);

    const res = await engine.execute('promote');
    expect(res.success).toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0].fields.promoted_topic).toBe('topic_1');
  });

  it('exposes non-id fields of the created record too ({var.title})', async () => {
    const engine = new AutomationEngine(makeLogger());
    const { data, updates } = fakeData();
    registerCrudNodes(engine, ctxWith(data));
    engine.registerFlow('promote2', {
      name: 'promote2', label: 'P', type: 'autolaunched',
      nodes: [
        { id: 'start', type: 'start', label: 'Start' },
        { id: 'mk', type: 'create_record', label: 'Create', config: { objectName: 'topic', outputVariable: 'topic', fields: { title: 'X' } } },
        { id: 'upd', type: 'update_record', label: 'Update', config: { objectName: 'signal', filter: { id: 'sig1' }, fields: { ref: '{topic.title}' } } },
        { id: 'end', type: 'end', label: 'End' },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'mk' },
        { id: 'e2', source: 'mk', target: 'upd' },
        { id: 'e3', source: 'upd', target: 'end' },
      ],
    } as any);
    const res = await engine.execute('promote2');
    expect(res.success).toBe(true);
    expect(updates[0].fields.ref).toBe('X');
  });
});

/**
 * The framework executor reads `config.fields`, but the AI build agent (and some
 * legacy flows) author the write map under `config.fieldValues`. Aliasing
 * `cfg.fields ?? cfg.fieldValues` — mirroring the existing `cfg.filter ?? cfg.filters`
 * tolerance — makes those flows insert/update real data instead of silently
 * writing an empty record.
 */
describe('create_record/update_record `fieldValues` alias (legacy authoring key)', () => {
  it('reads config.fieldValues when config.fields is absent (create + update)', async () => {
    const engine = new AutomationEngine(makeLogger());
    const { data, updates, inserts } = fakeData();
    registerCrudNodes(engine, ctxWith(data));
    engine.registerFlow('legacy', {
      name: 'legacy', label: 'L', type: 'autolaunched',
      nodes: [
        { id: 'start', type: 'start', label: 'Start' },
        { id: 'mk', type: 'create_record', label: 'Create', config: { objectName: 'topic', outputVariable: 'topic', fieldValues: { title: 'Legacy' } } },
        { id: 'upd', type: 'update_record', label: 'Update', config: { objectName: 'signal', filter: { id: 'sig1' }, fieldValues: { promoted_topic: '{topic.id}' } } },
        { id: 'end', type: 'end', label: 'End' },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'mk' },
        { id: 'e2', source: 'mk', target: 'upd' },
        { id: 'e3', source: 'upd', target: 'end' },
      ],
    } as any);

    const res = await engine.execute('legacy');
    expect(res.success).toBe(true);
    // create_record honored the legacy `fieldValues` key…
    expect(inserts).toHaveLength(1);
    expect(inserts[0].fields.title).toBe('Legacy');
    // …and so did update_record, with interpolation still running ({topic.id} → topic_1).
    expect(updates).toHaveLength(1);
    expect(updates[0].fields.promoted_topic).toBe('topic_1');
  });

  it('prefers config.fields over config.fieldValues when both are present', async () => {
    const engine = new AutomationEngine(makeLogger());
    const { data, inserts } = fakeData();
    registerCrudNodes(engine, ctxWith(data));
    engine.registerFlow('both', {
      name: 'both', label: 'B', type: 'autolaunched',
      nodes: [
        { id: 'start', type: 'start', label: 'Start' },
        { id: 'mk', type: 'create_record', label: 'Create', config: { objectName: 'topic', fields: { title: 'Canonical' }, fieldValues: { title: 'Legacy' } } },
        { id: 'end', type: 'end', label: 'End' },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'mk' },
        { id: 'e2', source: 'mk', target: 'end' },
      ],
    } as any);
    const res = await engine.execute('both');
    expect(res.success).toBe(true);
    expect(inserts[0].fields.title).toBe('Canonical');
  });
});
