// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Hook Binder
 *
 * Single, canonical entry point that turns declarative `Hook` metadata into
 * runtime registrations on the `ObjectQL` engine. Every metadata source —
 * `defineStack({ hooks })` (consumed by `AppPlugin`), the per-project
 * template seeder (`MultiProjectPlugin`), and the metadata service
 * (`ObjectQLPlugin.loadMetadataFromService`) — funnels through here so
 * that:
 *
 * - Inline function handlers and string-named handlers share one resolver.
 * - Declarative fields (`condition`, `async`, `retryPolicy`, `timeout`,
 *   `onError`) are honoured uniformly via `wrapDeclarativeHook`.
 * - Hooks can be unregistered as a unit via `packageId`, enabling clean
 *   hot-reload and app uninstall.
 *
 * The ObjectQL engine itself stays simple — it knows how to store and
 * trigger handlers, but knows nothing about declarative semantics. All
 * metadata-aware behaviour lives in this binder + the wrapper module.
 */

import type { Hook } from '@objectstack/spec/data';
import type { ObjectQL, HookHandler } from './engine.js';
import { wrapDeclarativeHook } from './hook-wrappers.js';

export interface BindHooksOptions {
  /** Owning package / app id — used for `unregisterHooksByPackage`. */
  packageId?: string;

  /**
   * Optional name → function map for resolving string `handler` references.
   * Typically supplied by `defineStack({ functions })` and merged with any
   * functions previously registered on the engine.
   */
  functions?: Record<string, HookHandler>;

  /** Logger; defaults to a silent no-op. */
  logger?: {
    debug: (msg: string, meta?: any) => void;
    info: (msg: string, meta?: any) => void;
    warn: (msg: string, meta?: any) => void;
    error: (msg: string, meta?: any) => void;
  };
}

const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/** Counter for stats. */
export interface BindHooksResult {
  registered: number;
  skipped: number;
  errors: Array<{ hook: string; reason: string }>;
}

/**
 * Bind a list of declarative `Hook` definitions to a running ObjectQL engine.
 *
 * Idempotent on `(packageId, hook.name, event, object)`: re-binding the
 * same set after a hot reload first calls `unregisterHooksByPackage`
 * (when `packageId` is provided).
 */
export function bindHooksToEngine(
  engine: ObjectQL,
  hooks: Hook[] | undefined,
  opts: BindHooksOptions = {},
): BindHooksResult {
  const logger = opts.logger ?? noopLogger;
  const result: BindHooksResult = { registered: 0, skipped: 0, errors: [] };

  if (!Array.isArray(hooks) || hooks.length === 0) {
    return result;
  }

  // Hot-reload friendly: drop anything we previously bound under this
  // packageId so the new set fully replaces the old.
  if (opts.packageId && typeof (engine as any).unregisterHooksByPackage === 'function') {
    try {
      (engine as any).unregisterHooksByPackage(opts.packageId);
    } catch (err: any) {
      logger.warn('[hook-binder] unregister-by-package failed; continuing', {
        packageId: opts.packageId,
        error: err?.message,
      });
    }
  }

  // Pre-load any inline functions supplied via `bundle.functions` so
  // string-handler resolution works.
  if (opts.functions && typeof (engine as any).registerFunction === 'function') {
    for (const [name, fn] of Object.entries(opts.functions)) {
      try {
        (engine as any).registerFunction(name, fn, opts.packageId);
      } catch (err: any) {
        logger.warn('[hook-binder] failed to register function', {
          name,
          error: err?.message,
        });
      }
    }
  }

  for (const hook of hooks) {
    try {
      const resolved = resolveHandler(engine, hook, opts);
      if (!resolved) {
        result.skipped += 1;
        result.errors.push({
          hook: hook.name,
          reason: typeof hook.handler === 'string'
            ? `unknown function '${hook.handler}'`
            : 'no handler',
        });
        logger.warn('[hook-binder] skipping hook with unresolved handler', {
          hook: hook.name,
          handler: hook.handler,
        });
        continue;
      }

      const wrapped = wrapDeclarativeHook(hook, resolved, { logger });
      const objects = normalizeObjects(hook.object);
      const events = Array.isArray(hook.events) ? hook.events : [];

      for (const event of events) {
        for (const object of objects) {
          engine.registerHook(event, wrapped, {
            object,
            priority: typeof hook.priority === 'number' ? hook.priority : 100,
            packageId: opts.packageId,
            // Reflect metadata so future tooling can introspect / unregister
            // and so we can detect duplicate name collisions.
            // The engine ignores unknown options today; this is forward-only.
            ...({ meta: hook, hookName: hook.name } as any),
          } as any);
          result.registered += 1;
        }
      }
    } catch (err: any) {
      result.errors.push({ hook: hook.name, reason: err?.message ?? String(err) });
      logger.error('[hook-binder] failed to bind hook', {
        hook: hook.name,
        error: err?.message,
      });
    }
  }

  if (result.registered > 0) {
    logger.debug('[hook-binder] hooks bound', {
      packageId: opts.packageId,
      registered: result.registered,
      skipped: result.skipped,
    });
  }

  return result;
}

function normalizeObjects(target: Hook['object']): string[] {
  if (Array.isArray(target)) return target.length > 0 ? target : ['*'];
  if (typeof target === 'string' && target.length > 0) return [target];
  return ['*'];
}

function resolveHandler(
  engine: ObjectQL,
  hook: Hook,
  opts: BindHooksOptions,
): HookHandler | undefined {
  const h = hook.handler;
  if (typeof h === 'function') return h as HookHandler;
  if (typeof h === 'string' && h.length > 0) {
    // Try the per-bundle map first (hot path during initial bind),
    // then fall back to whatever the engine already knows.
    const fromBundle = opts.functions?.[h];
    if (typeof fromBundle === 'function') return fromBundle;
    if (typeof (engine as any).resolveFunction === 'function') {
      const fn = (engine as any).resolveFunction(h);
      if (typeof fn === 'function') return fn as HookHandler;
    }
  }
  return undefined;
}
