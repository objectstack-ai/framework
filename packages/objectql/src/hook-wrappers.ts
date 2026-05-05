// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Declarative Hook Wrappers
 *
 * Turns a raw `HookHandler` into one that honours the declarative metadata
 * fields defined on `HookSchema` (`condition`, `async`, `retryPolicy`,
 * `timeout`, `onError`). This lives outside the engine's `triggerHooks`
 * loop so the engine stays minimal and the semantics are unit-testable in
 * isolation.
 *
 * The resulting wrapped handler keeps the original `(ctx) => Promise<void>`
 * signature, so `engine.registerHook` does not need to know anything about
 * the metadata-driven behaviours.
 */
import type { Hook, HookContext } from '@objectstack/spec/data';
import type { HookHandler } from './engine.js';
import { compileFormula, evaluateFormula } from './formula.js';

export interface WrapDeclarativeOptions {
  /** Logger for declarative-layer diagnostics (timeouts, retries, swallowed errors). */
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

/**
 * Wrap a hook handler so it honours the declarative fields defined on
 * `HookSchema`. The wrapping order, from outermost to innermost, is:
 *
 *   1. condition  → skip when formula evaluates falsy
 *   2. async      → fire-and-forget (after* events only)
 *   3. retry      → repeat on throw with backoff
 *   4. timeout    → abort if handler runs too long
 *   5. onError    → swallow when set to 'log'
 *
 * The condition formula is evaluated against the most useful record-shaped
 * payload available on the context (write payloads first, then `previous`,
 * then a flat merge of input). Read events typically have no record yet,
 * so a condition on a `beforeFind` will simply skip when no data is
 * present.
 */
export function wrapDeclarativeHook(
  meta: Hook,
  handler: HookHandler,
  opts: WrapDeclarativeOptions = {},
): HookHandler {
  const logger = opts.logger ?? noopLogger;
  const isAfterEvent = meta.events?.some((e) => typeof e === 'string' && e.startsWith('after')) ?? false;

  // Pre-compile condition once so each invocation is cheap.
  let conditionFn: ((record: any) => boolean) | undefined;
  if (meta.condition && typeof meta.condition === 'string' && meta.condition.trim()) {
    try {
      compileFormula(meta.condition);
      const expr = meta.condition;
      conditionFn = (record: any) => {
        try {
          return Boolean(evaluateFormula(expr, record ?? {}));
        } catch (err: any) {
          logger.warn('[hook] condition evaluation failed; treating as false', {
            hook: meta.name,
            condition: expr,
            error: err?.message,
          });
          return false;
        }
      };
    } catch (err: any) {
      logger.warn('[hook] condition formula failed to compile; condition ignored', {
        hook: meta.name,
        condition: meta.condition,
        error: err?.message,
      });
    }
  }

  const retryMax = Math.max(0, Number(meta.retryPolicy?.maxRetries ?? 0));
  const retryBackoffMs = Math.max(0, Number(meta.retryPolicy?.backoffMs ?? 0));
  const timeoutMs = typeof meta.timeout === 'number' && meta.timeout > 0 ? meta.timeout : undefined;
  const onError = meta.onError ?? 'abort';
  // `async` is only meaningful for after* events; ignore on before* (we must
  // wait for the handler to potentially mutate ctx.input).
  const fireAndForget = Boolean(meta.async) && isAfterEvent;

  const runWithTimeout = async (ctx: HookContext): Promise<void> => {
    if (!timeoutMs) {
      await handler(ctx);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.resolve().then(() => handler(ctx)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`Hook '${meta.name}' timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const runWithRetry = async (ctx: HookContext): Promise<void> => {
    let attempt = 0;
    let lastErr: unknown;
    // attempts = 1 + retryMax
    while (attempt <= retryMax) {
      try {
        await runWithTimeout(ctx);
        return;
      } catch (err) {
        lastErr = err;
        attempt += 1;
        if (attempt > retryMax) break;
        if (retryBackoffMs > 0) {
          await new Promise((r) => setTimeout(r, retryBackoffMs * attempt));
        }
        logger.warn('[hook] retrying after failure', {
          hook: meta.name,
          attempt,
          maxRetries: retryMax,
          error: (err as any)?.message,
        });
      }
    }
    throw lastErr;
  };

  const runWithErrorPolicy = async (ctx: HookContext): Promise<void> => {
    try {
      await runWithRetry(ctx);
    } catch (err) {
      if (onError === 'log') {
        logger.error('[hook] handler failed (onError=log; suppressing)', {
          hook: meta.name,
          object: ctx.object,
          event: ctx.event,
          error: (err as any)?.message,
        });
        return;
      }
      throw err;
    }
  };

  return async (ctx: HookContext): Promise<void> => {
    // 1. Condition gate
    if (conditionFn) {
      const record = pickRecordPayload(ctx);
      if (!conditionFn(record)) {
        logger.debug('[hook] skipped by condition', {
          hook: meta.name,
          object: ctx.object,
          event: ctx.event,
        });
        return;
      }
    }

    // 2. Fire-and-forget for declarative async after* hooks
    if (fireAndForget) {
      void runWithErrorPolicy(ctx).catch((err) => {
        logger.error('[hook] async handler error (fire-and-forget)', {
          hook: meta.name,
          error: (err as any)?.message,
        });
      });
      return;
    }

    await runWithErrorPolicy(ctx);
  };
}

/**
 * Choose the record-shaped object the condition formula should evaluate
 * against. Order:
 *   1. ctx.input.data — write operations carry the new record here
 *   2. ctx.previous   — update/delete carry pre-image here
 *   3. ctx.input      — fall back to flat input bag (read ops, custom shapes)
 */
function pickRecordPayload(ctx: HookContext): any {
  const input: any = ctx.input ?? {};
  if (input && typeof input === 'object' && input.data && typeof input.data === 'object') {
    return input.data;
  }
  if (ctx.previous && typeof ctx.previous === 'object') {
    return ctx.previous;
  }
  return input;
}
