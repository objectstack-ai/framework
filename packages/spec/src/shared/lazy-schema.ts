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
 * Emergency rollback: set `OBJECTSTACK_EAGER_SCHEMAS=1` to evaluate the
 * factory immediately and bypass the Proxy entirely.
 */
export function lazySchema<T extends z.ZodTypeAny>(factory: () => T): T {
  if (typeof process !== 'undefined' && process.env?.OBJECTSTACK_EAGER_SCHEMAS === '1') {
    return factory();
  }

  let cached: T | undefined;
  const resolve = (): T => {
    if (cached === undefined) cached = factory();
    return cached;
  };

  const target = function lazyZod() {} as unknown as T;

  const proxy = new Proxy(target as object, {
    get(_t, prop) {
      const real = resolve() as unknown as Record<PropertyKey, unknown>;
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
