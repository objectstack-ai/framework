// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { lazySchema } from './lazy-schema';

describe('lazySchema', () => {
  it('does not invoke factory until first access', () => {
    const factory = vi.fn(() => z.object({ name: z.string() }));
    lazySchema(factory);
    expect(factory).not.toHaveBeenCalled();
  });

  it('invokes factory exactly once across many parses', () => {
    const factory = vi.fn(() => z.object({ name: z.string() }));
    const schema = lazySchema(factory);
    schema.parse({ name: 'a' });
    schema.parse({ name: 'b' });
    schema.safeParse({ name: 'c' });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('parses and rejects identical to underlying schema', () => {
    const schema = lazySchema(() => z.object({ age: z.number() }));
    expect(schema.parse({ age: 5 })).toEqual({ age: 5 });
    const r = schema.safeParse({ age: 'x' });
    expect(r.success).toBe(false);
  });

  it('forwards .shape, .optional, .array', () => {
    const schema = lazySchema(() => z.object({ id: z.string() }));
    expect((schema as any).shape.id).toBeDefined();
    const opt = (schema as any).optional();
    expect(opt.safeParse(undefined).success).toBe(true);
    const arr = (schema as any).array();
    expect(arr.safeParse([{ id: 'a' }]).success).toBe(true);
  });

  it('preserves .refine / .transform behavior', () => {
    const schema = lazySchema(() =>
      z.string().transform((s) => s.toUpperCase()).pipe(z.string().min(2)),
    );
    expect(schema.parse('ab')).toBe('AB');
  });

  it('respects OS_EAGER_SCHEMAS=1', () => {
    const prev = process.env.OS_EAGER_SCHEMAS;
    process.env.OS_EAGER_SCHEMAS = '1';
    try {
      const factory = vi.fn(() => z.object({ x: z.number() }));
      lazySchema(factory);
      expect(factory).toHaveBeenCalledTimes(1);
    } finally {
      if (prev === undefined) delete process.env.OS_EAGER_SCHEMAS;
      else process.env.OS_EAGER_SCHEMAS = prev;
    }
  });
});

/**
 * zod's `toJSONSchema` keys its `seen` map on the traversed node (the Proxy),
 * while its wrapper-type processors (pipe/lazy/optional/…) look themselves up
 * via the construction-time REAL instance. Without the `_zod` facade aliasing
 * the two identities, any lazySchema wrapping a non-object root — e.g. the
 * ADR-0089 D3a `.strict().transform(…)` pipes — crashed with
 * `Cannot set properties of undefined (setting 'ref')` (objectui#2561).
 */
describe('lazySchema × z.toJSONSchema identity', () => {
  const TO_JSON = { io: 'input', unrepresentable: 'any' } as const;

  it('converts a lazy `.strict().transform(…)` pipe (ADR-0089 D3a shape)', () => {
    const schema = lazySchema(() =>
      z.object({ name: z.string() }).strict().transform((v) => v),
    );
    const json = z.toJSONSchema(schema, TO_JSON) as Record<string, any>;
    expect(json.properties?.name).toBeDefined();
  });

  it('converts recursion reaching the pipe through `z.lazy(() => proxy)` (FormFieldSchema shape)', () => {
    const NodeSchema: z.ZodType<any> = lazySchema(() =>
      z
        .object({
          field: z.string(),
          fields: z.array(z.lazy(() => NodeSchema)).optional(),
        })
        .strict()
        .transform((v) => v),
    );
    const json = z.toJSONSchema(NodeSchema, TO_JSON);
    expect(JSON.stringify(json)).toContain('field');
  });

  it('does not crash when one conversion sees both the proxy and the real instance', () => {
    const Leaf: z.ZodType<any> = lazySchema(() =>
      z.object({ id: z.string() }).strict().transform((v) => v),
    );
    // `.optional()` resolves through the proxy and captures the REAL pipe as
    // its innerType; the `z.lazy` getter hands zod the PROXY — one traversal
    // meets both identities in either order.
    const DocA = z.object({
      a: (Leaf as any).optional(),
      b: z.lazy(() => Leaf),
    });
    const DocB = z.object({
      b: z.lazy(() => Leaf),
      a: (Leaf as any).optional(),
    });
    for (const Doc of [DocA, DocB]) {
      const json = z.toJSONSchema(Doc, TO_JSON) as Record<string, any>;
      expect(json.properties?.a).toBeDefined();
      expect(json.properties?.b).toBeDefined();
    }
  });

  it('memoises the `_zod` facade (identity-stable across accesses)', () => {
    const schema = lazySchema(() => z.object({ x: z.number() }).strict().transform((v) => v));
    expect((schema as any)._zod).toBe((schema as any)._zod);
  });
});
