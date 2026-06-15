// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { extractHookBody } from '../src/utils/extract-hook-body.js';

describe('extractHookBody', () => {
  it('extracts a block-body arrow', () => {
    const fn = (ctx: any) => {
      ctx.input.x = 1;
      return ctx.input;
    };
    const ext = extractHookBody(fn, 'hook test');
    expect(ext.source).toContain('ctx.input.x = 1');
    expect(ext.source).toContain('return ctx.input');
    expect(ext.isExpression).toBe(false);
  });

  it('extracts an expression-body arrow as `return (...)`', () => {
    const fn: any = (ctx: any) => ctx.input.x + 1;
    const ext = extractHookBody(fn, 'hook test');
    expect(ext.isExpression).toBe(true);
    expect(ext.source).toMatch(/return \(.*ctx\.input\.x \+ 1.*\);/);
  });

  it('extracts a function expression body', () => {
    const fn = function (ctx: any) {
      ctx.input.y = 2;
    };
    const ext = extractHookBody(fn, 'hook fnexpr');
    expect(ext.source).toContain('ctx.input.y = 2');
  });

  it('infers api.read capability', () => {
    const fn = async (ctx: any) => {
      const n = await ctx.api.object('foo').count({});
      return n;
    };
    const ext = extractHookBody(fn, 'hook a');
    expect(ext.capabilities).toContain('api.read');
  });

  it('infers api.read on aliased ctx.api', () => {
    const fn = async (ctx: any) => {
      const api = ctx.api;
      return await api.object('foo').count({});
    };
    const ext = extractHookBody(fn, 'hook b');
    expect(ext.capabilities).toContain('api.read');
  });

  it('infers api.write', () => {
    const fn = async (ctx: any) => {
      await ctx.api.object('foo').update('id', {});
    };
    expect(extractHookBody(fn, 'hook c').capabilities).toContain('api.write');
  });

  it('infers log', () => {
    const fn = (ctx: any) => {
      ctx.log.info('hi');
    };
    expect(extractHookBody(fn, 'hook d').capabilities).toContain('log');
  });

  it('rejects fetch()', () => {
    const fn = async (_ctx: any) => {
      await fetch('https://example.com');
    };
    expect(() => extractHookBody(fn, 'hook bad')).toThrow(/fetch/);
  });

  it('rejects process access', () => {
    const fn = (_ctx: any) => {
      const env = (process as any).env.X;
      return env;
    };
    expect(() => extractHookBody(fn, 'hook bad')).toThrow(/process/);
  });

  it('rejects eval', () => {
    const fn = (_ctx: any) => {
      // eslint-disable-next-line no-eval
      eval('1');
    };
    expect(() => extractHookBody(fn, 'hook bad')).toThrow(/eval/);
  });

  it('honours explicit @capabilities override', () => {
    const fn = (_ctx: any) => {
      // @capabilities api.read api.write log
      return 1;
    };
    const ext = extractHookBody(fn, 'hook e');
    expect(ext.capabilities.sort()).toEqual(['api.read', 'api.write', 'log']);
  });

  // #1876 — a handler that references a module-scope helper is not self-
  // contained; extraction must throw so lowerCallables falls back to bundling
  // (which carries the closure) instead of shipping a body that ReferenceErrors.
  it('rejects a handler that references a module-scope helper (#1876)', () => {
    const fn = (ctx: any) => {
      ctx.record.slug = moduleScopeHelper(ctx.record.name);
    };
    expect(() => extractHookBody(fn, 'hook free')).toThrow(/not in scope at runtime|moduleScopeHelper/);
  });

  it('extracts a self-contained handler that only uses params + globals (#1876)', () => {
    const fn = (ctx: any) => {
      ctx.record.id = Math.round(Number(ctx.record.raw));
      ctx.record.tags = JSON.stringify(ctx.record.list ?? []);
    };
    const ext = extractHookBody(fn, 'hook contained');
    expect(ext.source).toContain('Math.round');
  });
});

/** Module-scope helper used by the #1876 free-identifier test above. */
function moduleScopeHelper(s: string): string {
  return String(s).toLowerCase();
}
