// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Write gate (Gate 3) + introspection plumbing tests — ADR-0015 §5.3.
 *
 * Uses the real ObjectQL engine (no registry mock) with a minimal in-memory
 * driver, so the write gate is exercised through the genuine
 * registerApp → composeObject → getObject path (which preserves
 * `object.external` / `object.datasource`).
 */

import { describe, it, expect } from 'vitest';
import { ObjectQL } from './engine';
import type { IDataDriver } from '@objectstack/spec/contracts';
import { ExternalWriteForbiddenError } from '@objectstack/spec/shared';

function makeDriver(name: string): IDataDriver {
  const store = new Map<string, any>();
  return {
    name,
    version: '1.0.0',
    async connect() {},
    async disconnect() {},
    async find() { return []; },
    async findOne() { return null; },
    async count() { return 0; },
    async create(object: string, data: any) {
      const id = data.id ?? String(store.size + 1);
      const row = { ...data, id };
      store.set(`${object}:${id}`, row);
      return row;
    },
    async update(object: string, id: string, data: any) {
      const row = { ...(store.get(`${object}:${id}`) ?? {}), ...data, id };
      store.set(`${object}:${id}`, row);
      return row;
    },
    async delete(object: string, id: string) {
      return store.delete(`${object}:${id}`);
    },
    async bulkCreate(object: string, rows: any[]) {
      return rows.map((r) => {
        const id = r.id ?? String(store.size + 1);
        const row = { ...r, id };
        store.set(`${object}:${id}`, row);
        return row;
      });
    },
    async syncSchema() {},
    async dropTable() {},
  } as unknown as IDataDriver;
}

function makeEngine(opts: {
  dsSchemaMode?: 'managed' | 'external' | 'validate-only';
  dsAllowWrites?: boolean;
  objWritable?: boolean;
}) {
  const engine = new ObjectQL();
  engine.registerDriver(makeDriver('default'), true);
  engine.registerDriver(makeDriver('warehouse'));
  engine.registerDatasourceDef({
    name: 'warehouse',
    schemaMode: opts.dsSchemaMode ?? 'external',
    external: { allowWrites: opts.dsAllowWrites ?? false },
  });
  engine.registerApp({
    id: 'wh_pkg',
    name: 'Warehouse',
    objects: [
      {
        name: 'wh_order',
        datasource: 'warehouse',
        external: { remoteName: 'fact_orders', writable: opts.objWritable ?? false },
        fields: { order_id: { type: 'text' }, amount: { type: 'number' } },
      },
    ],
  } as any);
  return engine;
}

describe('write gate (ADR-0015 Gate 3)', () => {
  it('allows writes to a managed (default) datasource object', async () => {
    const engine = new ObjectQL();
    engine.registerDriver(makeDriver('default'), true);
    engine.registerApp({
      id: 'local_pkg',
      name: 'Local',
      objects: [{ name: 'task', fields: { title: { type: 'text' } } }],
    } as any);
    await expect(engine.insert('task', { title: 'ok' })).resolves.toBeDefined();
  });

  it('blocks insert on a federated object with no double opt-in', async () => {
    const engine = makeEngine({ dsAllowWrites: false, objWritable: false });
    await expect(engine.insert('wh_order', { order_id: 'o1' })).rejects.toBeInstanceOf(
      ExternalWriteForbiddenError,
    );
  });

  it('blocks insert when only the datasource opts in', async () => {
    const engine = makeEngine({ dsAllowWrites: true, objWritable: false });
    await expect(engine.insert('wh_order', { order_id: 'o1' })).rejects.toBeInstanceOf(
      ExternalWriteForbiddenError,
    );
  });

  it('blocks insert when only the object opts in', async () => {
    const engine = makeEngine({ dsAllowWrites: false, objWritable: true });
    await expect(engine.insert('wh_order', { order_id: 'o1' })).rejects.toBeInstanceOf(
      ExternalWriteForbiddenError,
    );
  });

  it('allows insert with the full double opt-in', async () => {
    const engine = makeEngine({ dsAllowWrites: true, objWritable: true });
    await expect(engine.insert('wh_order', { order_id: 'o1' })).resolves.toBeDefined();
  });

  it('blocks update and delete on a read-only federated object', async () => {
    const engine = makeEngine({ dsAllowWrites: false, objWritable: false });
    await expect(engine.update('wh_order', { id: 'x', amount: 1 })).rejects.toBeInstanceOf(
      ExternalWriteForbiddenError,
    );
    await expect(engine.delete('wh_order', { where: { id: 'x' } } as any)).rejects.toBeInstanceOf(
      ExternalWriteForbiddenError,
    );
  });

  it('allows writes when the datasource is explicitly managed', async () => {
    const engine = makeEngine({ dsSchemaMode: 'managed', dsAllowWrites: false, objWritable: false });
    await expect(engine.insert('wh_order', { order_id: 'o1' })).resolves.toBeDefined();
  });

  it('reports the stable error code on the thrown error', async () => {
    const engine = makeEngine({});
    await engine.insert('wh_order', { order_id: 'o1' }).catch((err: any) => {
      expect(err.code).toBe('EXTERNAL_WRITE_FORBIDDEN');
    });
  });
});

describe('engine.introspectDatasource (ADR-0015)', () => {
  it('delegates to the named driver introspectSchema()', async () => {
    const engine = new ObjectQL();
    engine.registerDriver(makeDriver('default'), true);
    const snapshot = { dialect: 'postgres', introspectedAt: 'now', tables: {} };
    const wh = makeDriver('warehouse') as any;
    wh.introspectSchema = async () => snapshot;
    engine.registerDriver(wh);
    await expect(engine.introspectDatasource('warehouse')).resolves.toBe(snapshot);
  });

  it('throws when the datasource has no registered driver', async () => {
    const engine = new ObjectQL();
    engine.registerDriver(makeDriver('default'), true);
    await expect(engine.introspectDatasource('ghost')).rejects.toThrow(/no registered driver/);
  });

  it('throws when the driver lacks introspectSchema', async () => {
    const engine = new ObjectQL();
    engine.registerDriver(makeDriver('default'), true);
    engine.registerDriver(makeDriver('plain'));
    await expect(engine.introspectDatasource('plain')).rejects.toThrow(/does not support introspectSchema/);
  });
});
