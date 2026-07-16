// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { z } from 'zod';

/**
 * Wrap a Zod schema constructor so its body is only evaluated on first use.
 *
 * Why: building Zod schemas at module-load creates millions of closures that
 * dominate dev-server RSS even though most schemas are never parsed in a
 * given session. Wrapping the constructor in a Proxy defers allocation until
 * the first property access (`.parse`, `.shape`, `._def`, etc.) and reuses
 * a single cached instance thereafter.
 *
 * Type system: the returned Proxy is structurally indistinguishable from the
 * underlying ZodType, so `z.infer<typeof X>` and `.parse()` callers do not
 * need to change.
 *
 * Emergency rollback: set `OS_EAGER_SCHEMAS=1` to evaluate the
 * factory immediately and bypass the Proxy entirely.
 */
export function lazySchema<T extends z.ZodTypeAny>(factory: () => T): T {
  if (typeof process !== 'undefined' && process.env?.OS_EAGER_SCHEMAS === '1') {
    return factory();
  }

  let cached: T | undefined;
  const resolve = (): T => {
    if (cached === undefined) cached = factory();
    return cached;
  };

  const target = function lazyZod() {} as unknown as T;

  /**
   * Memoised `_zod` facade (one per proxy — `_zod.run` is the parse hot path).
   *
   * Why it exists: zod's `toJSONSchema` traversal keys its `seen` map on the
   * node object it was handed — this Proxy, wherever the schema is referenced
   * lazily (a `z.lazy(() => X)` recursion getter, or a direct conversion
   * root). But zod's per-type JSON-Schema hooks close over the REAL instance
   * at construction time (`inst._zod.processJSONSchema = (ctx, …) =>
   * pipeProcessor(inst, ctx, …)`), and the wrapper-type processors
   * (pipe/lazy/optional/default/…) then resolve `ctx.seen.get(inst)` — which
   * misses when the entry was keyed on the Proxy, crashing with
   * `Cannot set properties of undefined (setting 'ref')`. Plain-object
   * schemas never look themselves up, which kept this latent until ADR-0089
   * D3a turned FormFieldSchema / PageComponentSchema into
   * `.strict().transform(…)` pipes.
   *
   * The facade prototype-delegates every `_zod` read to the real internals,
   * wrapping only `processJSONSchema` to alias the Proxy's `seen` entry onto
   * the real instance before delegating, so both identities resolve to the
   * same entry. If the real instance was already traversed under its own
   * identity it keeps its entry (alias, never clobber).
   */
  let zodFacade: object | undefined;
  const makeZodFacade = (real: T): object | undefined => {
    const realZod = (real as unknown as { _zod?: Record<string, unknown> })._zod;
    if (!realZod || typeof realZod.processJSONSchema !== 'function') {
      return realZod;
    }
    const delegate = realZod.processJSONSchema as (...a: unknown[]) => unknown;
    return Object.create(realZod as object, {
      processJSONSchema: {
        enumerable: true,
        value: (ctx: { seen?: Map<unknown, unknown> }, json: unknown, params: unknown) => {
          const seen = ctx?.seen;
          if (seen && typeof seen.get === 'function') {
            const entry = seen.get(proxy);
            if (entry !== undefined && !seen.has(real)) seen.set(real, entry);
          }
          return delegate(ctx, json, params);
        },
      },
    }) as object;
  };

  const proxy = new Proxy(target as object, {
    get(_t, prop) {
      const real = resolve() as unknown as Record<PropertyKey, unknown>;
      if (prop === '_zod') {
        zodFacade ??= makeZodFacade(real as unknown as T);
        return zodFacade;
      }
      const value = real[prop];
      if (typeof value === 'function') {
        return (value as (...a: unknown[]) => unknown).bind(real);
      }
      return value;
    },
    set(_t, prop, value) {
      const real = resolve() as unknown as Record<PropertyKey, unknown>;
      real[prop] = value;
      return true;
    },
    has(_t, prop) {
      return prop in (resolve() as object);
    },
    ownKeys() {
      return Reflect.ownKeys(resolve() as object);
    },
    getOwnPropertyDescriptor(_t, prop) {
      return Reflect.getOwnPropertyDescriptor(resolve() as object, prop);
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(resolve() as object);
    },
  });

  return proxy as T;
}
