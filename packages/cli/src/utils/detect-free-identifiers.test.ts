// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { detectFreeIdentifiers } from './detect-free-identifiers.js';

/** Helper: stringify a real function so we test the exact `.toString()` path. */
const src = (fn: (...a: any[]) => any) => String(fn);

describe('detectFreeIdentifiers (#1876 — body self-containment)', () => {
  describe('flags module-scope references (would ReferenceError at runtime)', () => {
    it('a helper call (arrow)', () => {
      const r = detectFreeIdentifiers('(ctx) => { ctx.record.slug = slugify(ctx.record.name); }');
      expect(r.unparsed).toBe(false);
      expect(r.free).toEqual(['slugify']);
    });

    it('a top-level const (function expression)', () => {
      const r = detectFreeIdentifiers('function h(ctx){ return TAX_RATE * ctx.amount; }');
      expect(r.free).toEqual(['TAX_RATE']);
    });

    it('object-method shorthand form', () => {
      const r = detectFreeIdentifiers('handler(ctx){ return fmt(ctx.x); }');
      expect(r.free).toEqual(['fmt']);
    });

    it('an implicit-return arrow', () => {
      const r = detectFreeIdentifiers('(ctx) => compute(ctx.a, ctx.b)');
      expect(r.free).toEqual(['compute']);
    });

    it('multiple distinct free names, sorted & de-duped', () => {
      const r = detectFreeIdentifiers('(ctx) => { a(ctx); b(ctx); a(ctx); return CONST; }');
      expect(r.free).toEqual(['CONST', 'a', 'b']);
    });
  });

  describe('does NOT flag self-contained handlers (false-positive guards)', () => {
    const selfContained: Array<[string, string]> = [
      ['member access only', '(ctx) => { ctx.record.slug = ctx.record.name.toLowerCase(); }'],
      ['local const', '(ctx) => { const s = ctx.record.name; return s.trim(); }'],
      ['globals (Math/JSON)', '(ctx) => { ctx.record.id = Math.round(JSON.parse(ctx.x).y); }'],
      ['destructured params', '({ record, api }) => { record.x = record.y; return api; }'],
      ['locally-declared helper', '(ctx) => { const f = (a) => a * 2; return f(ctx.n); }'],
      ['object shorthand of a local', '(ctx) => { const a = ctx.a; return { a }; }'],
      ['object literal keys', '(ctx) => ({ total: ctx.a, count: ctx.b })'],
      ['for-of loop binding', '(ctx) => { let sum = 0; for (const x of ctx.items) { sum += x; } ctx.sum = sum; }'],
      ['catch binding', '(ctx) => { try { ctx.run(); } catch (err) { ctx.log = err; } }'],
      ['param default uses global', '({ x = Math.PI }) => x'],
      ['returned object method closes over param', '(ctx) => ({ run() { return ctx.x; } })'],
      ['element access with local key', '(ctx) => { const k = ctx.key; return ctx.data[k]; }'],
      ['named function expression recursion', 'function fact(n){ return n <= 1 ? 1 : n * fact(n - 1); }'],
      ['nested destructuring', '({ a: { b } }) => b + 1'],
      ['rest params', '(...args) => args.length'],
      ['typeof a local', '(ctx) => { const v = ctx.v; return typeof v; }'],
    ];
    for (const [label, source] of selfContained) {
      it(label, () => {
        const r = detectFreeIdentifiers(source);
        expect(r.unparsed).toBe(false);
        expect(r.free).toEqual([]);
      });
    }
  });

  describe('real compiled `.toString()` shapes', () => {
    it('does not flag a self-contained closure', () => {
      const handler = (ctx: any) => {
        const name = String(ctx.record.name ?? '').trim();
        ctx.record.slug = name.toLowerCase().replace(/\s+/g, '-');
      };
      expect(detectFreeIdentifiers(src(handler)).free).toEqual([]);
    });
  });

  it('never invents free vars for non-handler junk (conservative — caller won\'t block)', () => {
    // Whether or not TS error-recovers a node, the safe outcome is no free vars
    // so extraction is never blocked on garbage. (peelToBlockBody rejects such
    // input earlier in the real path anyway.)
    expect(detectFreeIdentifiers('this is not a function').free).toEqual([]);
    expect(detectFreeIdentifiers('').free).toEqual([]);
    expect(detectFreeIdentifiers('{ not: valid').free).toEqual([]);
  });
});
