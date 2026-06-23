// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { AuditPlugin } from './audit-plugin.js';

/**
 * Regression coverage: a freshly provisioned env READS sys_activity (the home
 * page's recent-activity feed) before anything has WRITTEN to it. The plugin's
 * objects are otherwise lazy-created on first write, so the read used to hit
 * SQLite "no such table" — logged by the engine as a `Find operation failed`
 * ERROR on every load. AuditPlugin now provisions its system tables at
 * kernel:ready so a new env is consistent from the start.
 */

/**
 * A fake engine that models the lazy-table behavior: `find()` throws
 * "no such table" until `syncObjectSchema()` has created it. No `registerHook`,
 * so `installAuditWriters()` early-returns and we stay focused on provisioning.
 */
function makeFakeEngine() {
  const tables = new Set<string>();
  const synced: string[] = [];
  const engine = {
    async syncObjectSchema(name: string) {
      synced.push(name);
      tables.add(name);
    },
    async find(object: string) {
      if (!tables.has(object)) throw new Error(`no such table: ${object}`);
      return [] as unknown[];
    },
  };
  return { engine, synced };
}

function makeCtx(engine: unknown) {
  const services = new Map<string, unknown>([
    ['objectql', engine],
    ['manifest', { register() {} }],
  ]);
  const readyHooks: Array<() => Promise<void> | void> = [];
  const logger = {
    info() {}, warn() {}, error() {}, debug() {},
    child() { return logger; },
  };
  const ctx = {
    logger,
    getService(name: string) { return services.get(name); },
    registerService(name: string, svc: unknown) { services.set(name, svc); },
    hook(event: string, fn: () => Promise<void> | void) {
      if (event === 'kernel:ready') readyHooks.push(fn);
    },
  } as any;
  return { ctx, fireReady: async () => { for (const fn of readyHooks) await fn(); } };
}

describe('AuditPlugin — system table provisioning', () => {
  it('creates sys_audit_log / sys_activity / sys_comment on kernel:ready', async () => {
    const { engine, synced } = makeFakeEngine();
    const { ctx, fireReady } = makeCtx(engine);

    const plugin = new AuditPlugin();
    await plugin.init(ctx);
    await plugin.start(ctx);

    // Before kernel:ready the table is absent — the read that the activity feed
    // performs would throw the "no such table" the engine logs as an ERROR.
    await expect(engine.find('sys_activity')).rejects.toThrow(/no such table/);

    await fireReady();

    expect(synced).toEqual(
      expect.arrayContaining(['sys_audit_log', 'sys_activity', 'sys_comment']),
    );
    // The activity-feed read now degrades to empty instead of throwing.
    await expect(engine.find('sys_activity')).resolves.toEqual([]);
  });

  it('skips provisioning gracefully when the engine has no syncObjectSchema', async () => {
    // An engine/driver without on-demand DDL (e.g. a federated-only kernel)
    // must not blow up start().
    const engine = { async find() { return []; } };
    const { ctx, fireReady } = makeCtx(engine);

    const plugin = new AuditPlugin();
    await plugin.init(ctx);
    await plugin.start(ctx);
    await expect(fireReady()).resolves.toBeUndefined();
  });
});
