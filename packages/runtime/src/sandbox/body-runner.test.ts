// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { hookBodyRunnerFactory, actionBodyRunnerFactory } from './body-runner.js';
import { QuickJSScriptRunner } from './quickjs-runner.js';

describe('hookBodyRunnerFactory', () => {
  const runner = new QuickJSScriptRunner();

  it('returns undefined when hook has no body', () => {
    const factory = hookBodyRunnerFactory(runner, { ql: {}, appId: 'a' });
    expect(factory({ name: 'h', object: 'x', events: [], handler: () => {} } as any)).toBeUndefined();
  });

  it('returns undefined when body shape is invalid', () => {
    const warnings: any[] = [];
    const factory = hookBodyRunnerFactory(runner, {
      ql: {},
      appId: 'a',
      logger: { warn: (msg: string, m: any) => warnings.push({ msg, m }) },
    });
    const fn = factory({
      name: 'bad',
      events: [],
      object: 'x',
      body: { language: 'unknown', source: 'x' },
    } as any);
    expect(fn).toBeUndefined();
    expect(warnings.length).toBe(1);
  });

  it('runs an L2 hook body and merges return value into ctx.input', async () => {
    const factory = hookBodyRunnerFactory(runner, { ql: {}, appId: 'crm' });
    const fn = factory({
      name: 'normalize_email',
      object: 'contact',
      events: ['beforeInsert'],
      body: {
        language: 'js',
        source: 'return { email: ctx.input.email.trim().toLowerCase() };',
        capabilities: [],
      },
    } as any);
    expect(typeof fn).toBe('function');
    const engineCtx = { input: { email: '  Foo@Bar.COM  ' } } as any;
    await fn!(engineCtx);
    expect(engineCtx.input.email).toBe('foo@bar.com');
  });

  it('runs an L1 expression body without mutating input when no patch returned', async () => {
    const factory = hookBodyRunnerFactory(runner, { ql: {}, appId: 'crm' });
    const fn = factory({
      name: 'guard',
      object: 'opportunity',
      events: ['beforeUpdate'],
      body: {
        language: 'expression',
        source: 'true',
      },
    } as any);
    expect(typeof fn).toBe('function');
    const engineCtx = { input: { x: 1 } } as any;
    await fn!(engineCtx);
    expect(engineCtx.input.x).toBe(1);
  });

  it('proxies ctx.api.object to the host ObjectQL engine', async () => {
    let called = false;
    const ql = {
      object: (n: string) => ({
        count: () => {
          called = true;
          return n === 'opportunity' ? 4 : 0;
        },
      }),
    };
    const factory = hookBodyRunnerFactory(runner, { ql, appId: 'crm' });
    const fn = factory({
      name: 'count_op',
      object: 'account',
      events: ['afterInsert'],
      body: {
        language: 'js',
        source: 'return { opportunity_count: await ctx.api.object("opportunity").count() };',
        capabilities: ['api.read'],
      },
    } as any);
    const engineCtx = { input: {} } as any;
    await fn!(engineCtx);
    expect(called).toBe(true);
    expect(engineCtx.input.opportunity_count).toBe(4);
  });

  it('writes back direct ctx.input.x mutations made inside the sandbox (no return)', async () => {
    const factory = hookBodyRunnerFactory(runner, { ql: {}, appId: 'crm' });
    const fn = factory({
      name: 'normalize_account_number',
      object: 'account',
      events: ['beforeInsert'],
      body: {
        language: 'js',
        source: "if (ctx.input.account_number) ctx.input.account_number = String(ctx.input.account_number).toUpperCase();",
        capabilities: [],
      },
    } as any);
    const engineCtx = { input: { account_number: 'abc-9' } } as any;
    await fn!(engineCtx);
    expect(engineCtx.input.account_number).toBe('ABC-9');
  });

  it('awaits async ctx.api calls (real ObjectQL count is a Promise)', async () => {
    const ql = {
      object: () => ({
        count: async () => 17,
      }),
    };
    const factory = hookBodyRunnerFactory(runner, { ql, appId: 'crm' });
    const fn = factory({
      name: 'op_count_async',
      object: 'account',
      events: ['afterInsert'],
      body: {
        language: 'js',
        source: 'ctx.input.opportunity_count = await ctx.api.object("opportunity").count({});',
        capabilities: ['api.read'],
      },
    } as any);
    const engineCtx = { input: {} } as any;
    await fn!(engineCtx);
    expect(engineCtx.input.opportunity_count).toBe(17);
  });

  it('writes back through a Proxy-wrapped ctx.input (flat-record proxy from wrapDeclarativeHook)', async () => {
    const backing: Record<string, unknown> = { website: 'https://acme.com' };
    const proxy = new Proxy(backing, {
      get: (t, k) => (t as any)[k as string],
      set: (t, k, v) => {
        (t as any)[k as string] = v;
        return true;
      },
      ownKeys: (t) => Reflect.ownKeys(t),
      getOwnPropertyDescriptor: (t, k) => Reflect.getOwnPropertyDescriptor(t, k),
    });
    const factory = hookBodyRunnerFactory(runner, { ql: {}, appId: 'crm' });
    const fn = factory({
      name: 'lower_website',
      object: 'account',
      events: ['beforeInsert'],
      body: {
        language: 'js',
        source: "ctx.input.website = String(ctx.input.website).toLowerCase();",
        capabilities: [],
      },
    } as any);
    const engineCtx = { input: proxy } as any;
    await fn!(engineCtx);
    expect(backing.website).toBe('https://acme.com');
  });
});

describe('actionBodyRunnerFactory', () => {
  const runner = new QuickJSScriptRunner();

  it('returns undefined when action has no body', () => {
    const factory = actionBodyRunnerFactory(runner, { ql: {}, appId: 'crm' });
    expect(factory({ name: 'noop' })).toBeUndefined();
  });

  it('runs an L2 action body and returns its value', async () => {
    const factory = actionBodyRunnerFactory(runner, { ql: {}, appId: 'crm' });
    const fn = factory({
      name: 'double',
      object: 'quote',
      body: {
        language: 'js',
        source: 'return { doubled: input.n * 2 };',
        capabilities: [],
      },
    });
    expect(typeof fn).toBe('function');
    const out = await fn!({ params: { n: 21 } });
    expect(out).toEqual({ doubled: 42 });
  });

  it('proxies ctx.api in actions', async () => {
    const ql = {
      object: () => ({
        find: async () => [{ id: '1' }, { id: '2' }, { id: '3' }],
      }),
    };
    const factory = actionBodyRunnerFactory(runner, { ql, appId: 'crm' });
    const fn = factory({
      name: 'list',
      object: 'lead',
      body: {
        language: 'js',
        source: 'const rows = await ctx.api.object("lead").find({}); return { count: rows.length };',
        capabilities: ['api.read'],
      },
    });
    const out = await fn!({ params: {} });
    expect(out).toEqual({ count: 3 });
  });
});
