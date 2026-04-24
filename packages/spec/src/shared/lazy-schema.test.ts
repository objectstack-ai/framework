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

  it('respects OBJECTSTACK_EAGER_SCHEMAS=1', () => {
    const prev = process.env.OBJECTSTACK_EAGER_SCHEMAS;
    process.env.OBJECTSTACK_EAGER_SCHEMAS = '1';
    try {
      const factory = vi.fn(() => z.object({ x: z.number() }));
      lazySchema(factory);
      expect(factory).toHaveBeenCalledTimes(1);
    } finally {
      if (prev === undefined) delete process.env.OBJECTSTACK_EAGER_SCHEMAS;
      else process.env.OBJECTSTACK_EAGER_SCHEMAS = prev;
    }
  });
});
