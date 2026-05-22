// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { canonicalize, hashSpec } from '../src/canonicalize.js';

describe('canonicalize', () => {
  it('orders object keys lexicographically', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalize({ z: 1, a: 1, m: 1 })).toBe('{"a":1,"m":1,"z":1}');
  });

  it('is order-independent for objects', () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });

  it('preserves array order', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });

  it('drops undefined properties (matching JSON.stringify)', () => {
    expect(canonicalize({ a: 1, b: undefined, c: 2 })).toBe('{"a":1,"c":2}');
  });

  it('preserves null', () => {
    expect(canonicalize({ a: null })).toBe('{"a":null}');
  });

  it('recurses into nested objects', () => {
    expect(canonicalize({ outer: { b: 1, a: 2 } })).toBe('{"outer":{"a":2,"b":1}}');
  });

  it('recurses into nested arrays', () => {
    expect(canonicalize([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });

  it('handles primitives at the root', () => {
    expect(canonicalize('hello')).toBe('"hello"');
    expect(canonicalize(42)).toBe('42');
    expect(canonicalize(true)).toBe('true');
    expect(canonicalize(null)).toBe('null');
  });

  it('rejects NaN', () => {
    expect(() => canonicalize(NaN)).toThrow(/NaN/);
  });

  it('rejects Infinity', () => {
    expect(() => canonicalize(Infinity)).toThrow(/Infinity/);
    expect(() => canonicalize(-Infinity)).toThrow(/Infinity/);
  });

  it('rejects BigInt', () => {
    expect(() => canonicalize(BigInt(1))).toThrow(/BigInt/);
  });

  it('rejects functions', () => {
    expect(() => canonicalize(() => 1)).toThrow(/function/);
  });

  it('rejects symbols', () => {
    expect(() => canonicalize(Symbol('x'))).toThrow(/symbol/);
  });

  it('is idempotent: canonicalize(parse(canonicalize(x))) === canonicalize(x)', () => {
    const input = { c: [3, 1, 2], a: { z: true, y: null }, b: 'x' };
    const once = canonicalize(input);
    const twice = canonicalize(JSON.parse(once));
    expect(twice).toBe(once);
  });

  // ─── Property tests ────────────────────────────────────────────────

  const jsonValue: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
    leaf: fc.oneof(
      fc.string(),
      fc.boolean(),
      fc.constant(null),
      fc.integer({ min: -1e9, max: 1e9 }),
      // Limit floats to non-NaN/Infinity values
      fc.float({ noNaN: true, noDefaultInfinity: true }),
    ),
    node: fc.oneof(
      { maxDepth: 3 },
      tie('leaf'),
      fc.array(tie('node') as fc.Arbitrary<unknown>, { maxLength: 5 }),
      fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), tie('node') as fc.Arbitrary<unknown>, { maxKeys: 5 }),
    ),
  })).node;

  it('property: idempotence over arbitrary JSON-like values', () => {
    fc.assert(
      fc.property(jsonValue, (v) => {
        const once = canonicalize(v);
        const twice = canonicalize(JSON.parse(once));
        return once === twice;
      }),
      { numRuns: 200 },
    );
  });

  it('property: key-order independence', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), fc.integer()),
        (obj) => {
          const keys = Object.keys(obj);
          if (keys.length < 2) return true;
          const reordered: Record<string, unknown> = {};
          for (const k of [...keys].reverse()) reordered[k] = obj[k];
          return canonicalize(obj) === canonicalize(reordered);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('hashSpec', () => {
  it('produces a sha256:<64hex> string', () => {
    const h = hashSpec({ a: 1 });
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('is stable across runs', () => {
    expect(hashSpec({ a: 1, b: 2 })).toBe(hashSpec({ b: 2, a: 1 }));
  });

  it('changes when the spec changes', () => {
    expect(hashSpec({ a: 1 })).not.toBe(hashSpec({ a: 2 }));
  });

  it('matches a known-good fixture (regression guard)', () => {
    // If this ever changes, every stored hash in every repository becomes
    // invalid. Treat as a deliberate breaking change.
    expect(hashSpec({})).toBe(
      'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    );
  });

  it('property: equal canonical form ⇒ equal hash', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string({ minLength: 1, maxLength: 6 }), fc.integer()), (obj) => {
        const reordered = Object.fromEntries(Object.entries(obj).reverse());
        return hashSpec(obj) === hashSpec(reordered);
      }),
      { numRuns: 100 },
    );
  });
});
