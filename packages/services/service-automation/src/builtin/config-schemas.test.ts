// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Designer-parity configSchemas (#3304 — descriptor counterpart to objectui
 * #2670 Phase 3). The keyValue-capable nodes now publish a `configSchema` that
 * mirrors objectui's hardcoded field group, so the online (schema-driven) form
 * matches the offline one. The load-bearing shape is the free-form map —
 * `type: 'object'` + `additionalProperties: true` and NO fixed `properties` —
 * which the designer renders with its flat keyValue editor; `true`-permissive
 * because real metadata carries operator objects (`{"$ne": null}`), `{var}`
 * templates, and non-string literals as values.
 *
 * Deliberately schemaless (stay on the hardcoded designer form; a node with no
 * configSchema has NO online/offline divergence): `decision` (virtual Target
 * column derived from edges), `wait` (top-level `waitEventConfig` block),
 * `script` (actionType-conditional form) and `subflow` (top-level `timeoutMs`)
 * — a partial schema would drop those editors.
 */

import { describe, it, expect } from 'vitest';
import { AutomationEngine } from '../engine.js';
import { registerCrudNodes } from './crud-nodes.js';
import { registerLogicNodes } from './logic-nodes.js';
import { registerScreenNodes } from './screen-nodes.js';

function silentLogger() {
  return { info() {}, warn() {}, error() {}, debug() {}, child() { return silentLogger(); } } as any;
}
function ctx() {
  return { logger: silentLogger(), getService() { throw new Error('none'); } } as any;
}

interface SchemaProp {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaProp>;
  additionalProperties?: unknown;
  items?: SchemaProp;
  enum?: unknown[];
  xRef?: { kind?: string };
  xExpression?: string;
}

function schemaOf(engine: AutomationEngine, type: string) {
  const schema = engine.getActionDescriptor(type)?.configSchema as
    | { properties?: Record<string, SchemaProp>; required?: string[] }
    | undefined;
  expect(schema, `${type} should publish a configSchema`).toBeDefined();
  return schema!;
}

/** The keyValue contract: an open map with a value schema and no fixed props. */
function expectKeyValueMap(prop: SchemaProp | undefined, label: string) {
  expect(prop, label).toBeDefined();
  expect(prop!.type).toBe('object');
  expect(prop!.additionalProperties).toBe(true);
  expect(prop!.properties).toBeUndefined();
}

describe('builtin node configSchemas — designer parity (#3304)', () => {
  const engine = new AutomationEngine(silentLogger());
  registerCrudNodes(engine, ctx());
  registerLogicNodes(engine, ctx());
  registerScreenNodes(engine, ctx());

  it('CRUD quartet: object reference + keyValue maps, objectName required', () => {
    const get = schemaOf(engine, 'get_record');
    expect(get.properties?.objectName?.xRef?.kind).toBe('object');
    expectKeyValueMap(get.properties?.filter, 'get_record.filter');
    expect(get.properties?.limit?.type).toBe('integer');
    expect(get.required).toEqual(['objectName']);

    const create = schemaOf(engine, 'create_record');
    expect(create.properties?.objectName?.xRef?.kind).toBe('object');
    expectKeyValueMap(create.properties?.fields, 'create_record.fields');

    const update = schemaOf(engine, 'update_record');
    expectKeyValueMap(update.properties?.filter, 'update_record.filter');
    expectKeyValueMap(update.properties?.fields, 'update_record.fields');

    const del = schemaOf(engine, 'delete_record');
    expectKeyValueMap(del.properties?.filter, 'delete_record.filter');
  });

  it('assignment: a single free-form assignments map, nothing required', () => {
    const schema = schemaOf(engine, 'assignment');
    expectKeyValueMap(schema.properties?.assignments, 'assignment.assignments');
    expect(schema.required).toBeUndefined();
  });

  it('screen: field list with a CEL visibleWhen column, object-form refs, defaults map', () => {
    const schema = schemaOf(engine, 'screen');
    // The repeater's visibleWhen column is bare CEL → expression column.
    expect(schema.properties?.fields?.items?.properties?.visibleWhen?.xExpression).toBe('expression');
    expect(schema.properties?.fields?.items?.properties?.required?.type).toBe('boolean');
    expect(schema.properties?.objectName?.xRef?.kind).toBe('object');
    expect(schema.properties?.mode?.enum).toEqual(['create', 'edit']);
    expect(schema.properties?.description?.format).toBe('multiline');
    expectKeyValueMap(schema.properties?.defaults, 'screen.defaults');
  });

  it('decision / script stay deliberately schemaless (no partial forms)', () => {
    // A node with no configSchema renders identically online and offline (the
    // hardcoded fallback), so there is no divergence — and publishing a partial
    // schema would DROP editors the adapter cannot express (decision's virtual
    // Target column; script's actionType-conditional fields).
    expect(engine.getActionDescriptor('decision')?.configSchema).toBeUndefined();
    expect(engine.getActionDescriptor('script')?.configSchema).toBeUndefined();
  });
});
