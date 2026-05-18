// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { WebhooksPlugin, type WebhookDeliveryRecord } from './webhooks-plugin.js';

/**
 * Build a minimal in-memory realtime stub that records subscriptions and
 * exposes a publish() helper for tests.
 */
function makeRealtime() {
  const subs: Array<{
    id: string;
    channel: string;
    handler: (event: any) => Promise<void> | void;
    options?: any;
  }> = [];
  let counter = 0;
  return {
    subscribe: vi.fn(async (channel: string, handler: any, options?: any) => {
      const id = `sub-${++counter}`;
      subs.push({ id, channel, handler, options });
      return id;
    }),
    unsubscribe: vi.fn(async (id: string) => {
      const idx = subs.findIndex(s => s.id === id);
      if (idx >= 0) subs.splice(idx, 1);
    }),
    publish: vi.fn(async (event: any) => {
      for (const sub of [...subs]) {
        const opts = sub.options ?? {};
        if (opts.object && event.object !== opts.object) continue;
        if (opts.eventTypes && opts.eventTypes.length > 0 && !opts.eventTypes.includes(event.type)) continue;
        await sub.handler(event);
      }
    }),
    _subs: subs,
  };
}

function makeCtx(realtime: any) {
  const hooks: Record<string, Array<() => Promise<void> | void>> = {};
  return {
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
    getService: vi.fn((name: string) => {
      if (name === 'realtime') return realtime;
      throw new Error(`unknown service ${name}`);
    }),
    hook: vi.fn((name: string, fn: any) => {
      (hooks[name] ||= []).push(fn);
    }),
    _hooks: hooks,
  } as any;
}

describe('WebhooksPlugin', () => {
  beforeEach(() => {
    delete process.env.OBJECTSTACK_WEBHOOK_URL;
    delete process.env.OBJECTSTACK_WEBHOOK_SECRET;
    delete process.env.OBJECTSTACK_WEBHOOK_OBJECTS;
    delete process.env.OBJECTSTACK_WEBHOOK_EVENTS;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('stays dormant when no sinks configured', async () => {
    const realtime = makeRealtime();
    const ctx = makeCtx(realtime);
    const plugin = new WebhooksPlugin();
    await plugin.init(ctx);
    await plugin.start(ctx);
    // No kernel:ready hook fired yet, but even if it did there would be no subs.
    for (const fn of ctx._hooks['kernel:ready'] ?? []) await fn();
    expect(realtime.subscribe).not.toHaveBeenCalled();
    expect(ctx.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('no sinks configured'),
    );
  });

  it('subscribes to realtime and POSTs on data.record.created with HMAC signature', async () => {
    const realtime = makeRealtime();
    const ctx = makeCtx(realtime);
    const deliveries: WebhookDeliveryRecord[] = [];
    const fetchImpl = vi.fn(async (_url: string, init: any) => ({
      ok: true, status: 200, text: async () => '',
      headers: new Map(), bodyEcho: init,
    } as any));

    const plugin = new WebhooksPlugin({
      sinks: [{ id: 'crm', url: 'https://hooks.example.com/in', secret: 's3cret', objects: ['lead'] }],
      fetchImpl: fetchImpl as any,
      onDelivery: (rec) => deliveries.push(rec),
    });
    await plugin.init(ctx);
    await plugin.start(ctx);
    for (const fn of ctx._hooks['kernel:ready']) await fn();

    expect(realtime.subscribe).toHaveBeenCalledTimes(1);
    const event = {
      type: 'data.record.created',
      object: 'lead',
      payload: { recordId: 'L1', after: { id: 'L1', name: 'Acme' } },
      timestamp: new Date().toISOString(),
    };
    await realtime.publish(event);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['X-Objectstack-Event']).toBe('data.record.created');
    expect(init.headers['X-Objectstack-Object']).toBe('lead');
    const expectedSig = 'sha256=' + crypto.createHmac('sha256', 's3cret').update(init.body).digest('hex');
    expect(init.headers['X-Objectstack-Signature']).toBe(expectedSig);
    expect(JSON.parse(init.body)).toMatchObject({ type: 'data.record.created', object: 'lead' });
    expect(deliveries[0]).toMatchObject({ status: 'ok', httpStatus: 200, attempt: 1 });
  });

  it('filters by object whitelist when sink lists multiple objects', async () => {
    const realtime = makeRealtime();
    const ctx = makeCtx(realtime);
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 } as any));
    const plugin = new WebhooksPlugin({
      sinks: [{ id: 'multi', url: 'https://x', objects: ['lead', 'account'] }],
      fetchImpl: fetchImpl as any,
    });
    await plugin.init(ctx);
    await plugin.start(ctx);
    for (const fn of ctx._hooks['kernel:ready']) await fn();

    await realtime.publish({ type: 'data.record.created', object: 'lead', payload: {}, timestamp: '' });
    await realtime.publish({ type: 'data.record.created', object: 'contact', payload: {}, timestamp: '' });
    await realtime.publish({ type: 'data.record.created', object: 'account', payload: {}, timestamp: '' });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries on 5xx then succeeds', async () => {
    const realtime = makeRealtime();
    const ctx = makeCtx(realtime);
    const deliveries: WebhookDeliveryRecord[] = [];
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      if (calls < 3) return { ok: false, status: 503 } as any;
      return { ok: true, status: 200 } as any;
    });
    const plugin = new WebhooksPlugin({
      sinks: [{ id: 'flaky', url: 'https://x', retries: 5 }],
      fetchImpl: fetchImpl as any,
      onDelivery: (rec) => deliveries.push(rec),
    });
    await plugin.init(ctx);
    await plugin.start(ctx);
    for (const fn of ctx._hooks['kernel:ready']) await fn();
    await realtime.publish({ type: 'data.record.updated', object: 'lead', payload: {}, timestamp: '' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(deliveries.filter(d => d.status === 'retrying').length).toBe(2);
    expect(deliveries.at(-1)).toMatchObject({ status: 'ok', attempt: 3 });
  }, 20_000);

  it('does NOT retry on 4xx (permanent rejection)', async () => {
    const realtime = makeRealtime();
    const ctx = makeCtx(realtime);
    const deliveries: WebhookDeliveryRecord[] = [];
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401 } as any));
    const plugin = new WebhooksPlugin({
      sinks: [{ id: 'auth', url: 'https://x', retries: 5 }],
      fetchImpl: fetchImpl as any,
      onDelivery: (r) => deliveries.push(r),
    });
    await plugin.init(ctx);
    await plugin.start(ctx);
    for (const fn of ctx._hooks['kernel:ready']) await fn();
    await realtime.publish({ type: 'data.record.deleted', object: 'lead', payload: {}, timestamp: '' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(deliveries.at(-1)).toMatchObject({ status: 'failed', httpStatus: 401, attempt: 1 });
  });

  it('reads URL+secret+filters from env vars when no sinks supplied', async () => {
    process.env.OBJECTSTACK_WEBHOOK_URL = 'https://a.example,https://b.example';
    process.env.OBJECTSTACK_WEBHOOK_SECRET = 'env-secret';
    process.env.OBJECTSTACK_WEBHOOK_OBJECTS = 'lead,account';
    process.env.OBJECTSTACK_WEBHOOK_EVENTS = 'data.record.created';
    const realtime = makeRealtime();
    const ctx = makeCtx(realtime);
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 } as any));
    const plugin = new WebhooksPlugin({ fetchImpl: fetchImpl as any });
    await plugin.init(ctx);
    await plugin.start(ctx);
    for (const fn of ctx._hooks['kernel:ready']) await fn();

    // Two sinks → two realtime subscriptions.
    expect(realtime.subscribe).toHaveBeenCalledTimes(2);
    await realtime.publish({ type: 'data.record.created', object: 'lead', payload: {}, timestamp: '' });
    // Two sinks both fire.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [urlA] = fetchImpl.mock.calls[0]!;
    const [urlB] = fetchImpl.mock.calls[1]!;
    expect([urlA, urlB].sort()).toEqual(['https://a.example', 'https://b.example']);
  });

  it('unsubscribes on stop', async () => {
    const realtime = makeRealtime();
    const ctx = makeCtx(realtime);
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 } as any));
    const plugin = new WebhooksPlugin({
      sinks: [{ id: 'a', url: 'https://x' }],
      fetchImpl: fetchImpl as any,
    });
    await plugin.init(ctx);
    await plugin.start(ctx);
    for (const fn of ctx._hooks['kernel:ready']) await fn();
    expect(realtime._subs).toHaveLength(1);
    await plugin.stop(ctx);
    expect(realtime.unsubscribe).toHaveBeenCalled();
    expect(realtime._subs).toHaveLength(0);
  });
});
