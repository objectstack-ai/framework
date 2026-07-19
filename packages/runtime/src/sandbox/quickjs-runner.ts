// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * # QuickJS-backed ScriptRunner
 *
 * Implements `ScriptRunner` using `quickjs-emscripten` (pure-WASM, edge-safe).
 *
 * Responsibilities:
 * - L1 ExpressionBody — evaluated as a `return (<source>)` snippet.
 * - L2 ScriptBody    — wrapped in `(async (ctx) => { <source> })(ctx)` (hooks)
 *                      or `(async (input, ctx) => { <source> })(input, ctx)` (actions).
 * - Hard timeout via QuickJS interrupt handler.
 * - Capability gating — host-side `ctx.api`, `ctx.crypto`, `ctx.log` are only
 *   wired into the VM if the body declares the matching capability.
 * - Structured marshalling — JSON-serialisable values cross the VM boundary.
 *   Functions are exposed as host-resident proxies (the script calls
 *   `ctx.api.object('foo').count(...)` and the host method runs in node).
 *
 * Trade-offs:
 * - Per-invocation overhead is dominated by VM creation: every call compiles a
 *   fresh WASM module via `newAsyncContext()` and disposes it on settle (see
 *   {@link QuickJSScriptRunner.execute}). Runtimes are deliberately NOT pooled —
 *   a shared module hit HostRef double-free crashes when contexts were disposed
 *   concurrently, and the per-invocation isolate sidesteps that. The cost is
 *   real, though: a nested hook compiles a SECOND module inside the parent's
 *   budget, so on a loaded/slow host the fixed compile cost alone can trip the
 *   hook timeout. The per-invocation timeout default is therefore env-overridable
 *   via `OS_SANDBOX_HOOK_TIMEOUT_MS` / `OS_SANDBOX_ACTION_TIMEOUT_MS`
 *   (framework#3259) so an operator can raise the floor without a code change.
 * - Memory caps are advisory under quickjs (engine has no hard MB cap); the
 *   runner uses `setMemoryLimit(memoryMb * 1MB)` which is best-effort.
 */

import {
  newAsyncContext,
  type QuickJSAsyncContext,
  type QuickJSHandle,
} from 'quickjs-emscripten';
import { resolveSandboxTimeoutMs } from '@objectstack/types';
import type { HookBody, ScriptBody, ExpressionBody, HookBodyCapability } from '@objectstack/spec/data';
import type {
  ScriptContext,
  ScriptOrigin,
  ScriptResult,
  ScriptRunOptions,
  ScriptRunner,
} from './script-runner.js';

const DEFAULT_HOOK_TIMEOUT_MS = 250;
const DEFAULT_ACTION_TIMEOUT_MS = 5000;
const DEFAULT_MEMORY_MB = 32;

export interface QuickJSScriptRunnerOptions {
  /** Default per-invocation timeout for hooks (ms). */
  hookTimeoutMs?: number;
  /** Default per-invocation timeout for actions (ms). */
  actionTimeoutMs?: number;
  /** Default memory cap in MB. */
  memoryMb?: number;
}

export class QuickJSScriptRunner implements ScriptRunner {
  private opts: Required<QuickJSScriptRunnerOptions>;

  constructor(opts: QuickJSScriptRunnerOptions = {}) {
    // Precedence for the per-invocation timeout default: an explicit constructor
    // option wins; else the deployment's `OS_SANDBOX_{HOOK,ACTION}_TIMEOUT_MS`
    // env override (so a loaded/slow host — e.g. an oversubscribed CI runner —
    // can raise the floor without a code change, framework#3259); else the
    // built-in default. `resolveSandboxTimeoutMs` returns the built-in fallback
    // untouched when the env var is unset, so default behaviour is unchanged.
    this.opts = {
      hookTimeoutMs: opts.hookTimeoutMs ?? resolveSandboxTimeoutMs('hook', DEFAULT_HOOK_TIMEOUT_MS),
      actionTimeoutMs: opts.actionTimeoutMs ?? resolveSandboxTimeoutMs('action', DEFAULT_ACTION_TIMEOUT_MS),
      memoryMb: opts.memoryMb ?? DEFAULT_MEMORY_MB,
    };
  }

  async evalExpression(
    body: ExpressionBody,
    ctx: ScriptContext,
    opts: ScriptRunOptions,
  ): Promise<ScriptResult> {
    return this.execute({
      isExpression: true,
      source: body.source,
      capabilities: [],
      timeoutMs: this.resolveTimeout(opts, undefined),
      memoryMb: this.opts.memoryMb,
      ctx,
      origin: opts.origin,
    });
  }

  async runScript(
    body: ScriptBody,
    ctx: ScriptContext,
    opts: ScriptRunOptions,
  ): Promise<ScriptResult> {
    return this.execute({
      isExpression: false,
      source: body.source,
      capabilities: body.capabilities,
      timeoutMs: this.resolveTimeout(opts, body.timeoutMs),
      memoryMb: body.memoryMb ?? this.opts.memoryMb,
      ctx,
      origin: opts.origin,
    });
  }

  run(body: HookBody, ctx: ScriptContext, opts: ScriptRunOptions): Promise<ScriptResult> {
    return body.language === 'expression'
      ? this.evalExpression(body, ctx, opts)
      : this.runScript(body, ctx, opts);
  }

  async dispose(): Promise<void> {
    /* no-op — runtimes are per-invocation in v1 */
  }

  /**
   * Resolve the effective per-invocation timeout.
   *
   * The engine default (`hookTimeoutMs` / `actionTimeoutMs`) is a FALLBACK used
   * only when the caller supplies no explicit timeout — it is NOT a hard
   * ceiling. Whichever explicit timeout the caller *did* supply wins: the body's
   * own `timeoutMs` (the spec permits up to 30_000ms — see `ScriptBody.timeoutMs`)
   * and/or an enclosing hook/action timeout passed via `opts.timeoutMs`; when
   * both are present the smaller wins, matching the spec's "smaller of this and
   * the enclosing hook/action timeout wins".
   *
   * Previously the default was folded straight into `Math.min(...)`, so for
   * hooks — whose default is 250ms — it *always* dominated: a body that declared
   * `timeoutMs: 5000` to give a legitimate nested cross-object write room to
   * settle was silently clamped back to 250ms and killed mid-flight. That made
   * the spec's `ScriptBody.timeoutMs` a declared-but-unenforced knob for hooks
   * and pushed template authors toward denormalized rollup workarounds (#1867).
   */
  private resolveTimeout(opts: ScriptRunOptions, bodyTimeoutMs: number | undefined): number {
    const def = opts.origin.kind === 'hook' ? this.opts.hookTimeoutMs : this.opts.actionTimeoutMs;
    const explicit = [opts.timeoutMs, bodyTimeoutMs].filter((n): n is number => typeof n === 'number');
    return explicit.length > 0 ? Math.min(...explicit) : def;
  }

  private async execute(args: {
    isExpression: boolean;
    source: string;
    capabilities: HookBodyCapability[];
    timeoutMs: number;
    memoryMb: number;
    ctx: ScriptContext;
    origin: ScriptOrigin;
  }): Promise<ScriptResult> {
    // Each invocation gets its own WebAssembly module via newAsyncContext().
    // This is the canonical "per-invocation isolate" model and avoids the
    // shared-runtime HostRef double-free issues we hit with a singleton
    // QuickJSAsyncWASMModule when contexts are disposed concurrently.
    const vm = await newAsyncContext();
    const runtime = vm.runtime;
    runtime.setMemoryLimit(args.memoryMb * 1024 * 1024);
    runtime.setMaxStackSize(512 * 1024);

    const start = Date.now();
    const deadline = start + args.timeoutMs;
    runtime.setInterruptHandler(() => Date.now() > deadline);

    // Shared, per-invocation transaction state. `ctx.api.transaction(fn)` opens
    // it (routing subsequent ctx.api ops through the tx-scoped context) and
    // closes it on commit/rollback. The execute() finally consults it to roll
    // back a transaction the body left open (threw mid-tx, or timed out before
    // its commit/rollback settled).
    const txState: TxState = { api: null, handle: null, open: false };

    try {
      this.installCtx(vm, args.ctx, new Set(args.capabilities), args.origin, txState);

      // L1 expressions are pure-sync: evaluate and read __result.
      if (args.isExpression) {
        const wrapped = `globalThis.__result = JSON.stringify((function(){ return (${args.source}); })());`;
        const result = vm.evalCode(wrapped);
        if (result.error) {
          const err = vm.dump(result.error);
          result.error.dispose();
          throw new SandboxError(
            `${args.origin.kind} '${args.origin.name}' threw: ${formatErr(err)}`,
            userFacingMessage(formatErr(err)),
          );
        }
        result.value.dispose();
        const resH = vm.getProp(vm.global, '__result');
        const resStr = vm.dump(resH);
        resH.dispose();
        const value = resStr === undefined || resStr === null || resStr === 'null'
          ? undefined
          : safeJsonParse(resStr);
        return { value, durationMs: Date.now() - start };
      }

      // L2 scripts: wrap as async IIFE and use side-channel + asyncified pump.
      // Each pump iteration:
      //   1. yield to the host event loop (lets host promises settle)
      //   2. drain QuickJS pending jobs (advances the .then chain)
      //   3. read __result/__error from the VM
      const wrapped = args.origin.kind === 'hook'
        ? `globalThis.__result = undefined; globalThis.__error = undefined;
            (async (ctx) => { ${args.source} })(globalThis.__ctx).then(
              function(v){ globalThis.__result = JSON.stringify(v === undefined ? null : v); },
              function(e){ globalThis.__error = (e && e.message) ? (e.name + ': ' + e.message) : String(e); }
            );`
        : `globalThis.__result = undefined; globalThis.__error = undefined;
            (async (input, ctx) => { ${args.source} })(globalThis.__input, globalThis.__ctx).then(
              function(v){ globalThis.__result = JSON.stringify(v === undefined ? null : v); },
              function(e){ globalThis.__error = (e && e.message) ? (e.name + ': ' + e.message) : String(e); }
            );`;

      const evalRes = await vm.evalCodeAsync(wrapped);
      if (evalRes.error) {
        const err = vm.dump(evalRes.error);
        evalRes.error.dispose();
        throw new SandboxError(
          `${args.origin.kind} '${args.origin.name}' threw: ${formatErr(err)}`,
          userFacingMessage(formatErr(err)),
        );
      }
      evalRes.value.dispose();

      // Drive the script's async continuations to completion. Each iteration
      // yields to the host event loop (so in-flight host promises settle and
      // resolve their VM-side deferred handles) and then drains the QuickJS job
      // queue. The ONLY bound on how long we wait is the deadline: a slow but
      // progressing script — many sequential host writes, or one write that
      // synchronously drives a downstream record-change automation — must be
      // allowed to finish within its timeout, and a stuck / never-settling host
      // call is cut off here (the QuickJS interrupt handler can't fire while we
      // are parked on a host promise, so this deadline check is the backstop).
      // The previous fixed `pumps < 1000` cap fired in ~tens of ms on legitimate
      // work and surfaced as "did not resolve after 1000 pump iterations".
      // Adaptive idle backoff (#3233): while the script is progressing we pump
      // on setImmediate (near-zero latency); once it is only *waiting* on an
      // in-flight host promise — 0 VM jobs executed per pump — we ramp the yield
      // up to a small capped setTimeout instead of spinning setImmediate
      // ~200k×/s doing nothing. Any executed job (a settled host call, a resumed
      // continuation) resets the fast path, so sequential host calls and
      // multi-turn work keep their low latency; only a genuinely idle wait backs
      // off, and by at most IDLE_BACKOFF_CAP_MS.
      const FAST_PUMPS = 4;
      const IDLE_BACKOFF_CAP_MS = 8;
      let pumps = 0;
      let idle = 0;
      for (;;) {
        // Yield to the host event loop so in-flight host promises can settle.
        if (idle < FAST_PUMPS) {
          await new Promise<void>((resolve) => setImmediate(resolve));
        } else {
          const backoffMs = Math.min(IDLE_BACKOFF_CAP_MS, 1 << Math.min(idle - FAST_PUMPS, 3));
          await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
        }

        const pending = runtime.executePendingJobs();
        if (pending.error) {
          const err = vm.dump(pending.error);
          pending.error.dispose();
          throw new SandboxError(
            `${args.origin.kind} '${args.origin.name}' threw: ${formatErr(err)}`,
            userFacingMessage(formatErr(err)),
          );
        }

        const errH = vm.getProp(vm.global, '__error');
        const errStr = vm.dump(errH);
        errH.dispose();
        if (errStr) {
          throw new SandboxError(
            `${args.origin.kind} '${args.origin.name}' threw: ${errStr}`,
            userFacingMessage(String(errStr)),
          );
        }

        const resH = vm.getProp(vm.global, '__result');
        const resStr = vm.dump(resH);
        resH.dispose();
        if (resStr !== undefined && resStr !== null) {
          const value = resStr === 'null' ? undefined : safeJsonParse(resStr);
          // Capture mutated ctx.input so the host can write through.
          const mutatedInput = readCtxInputJson(vm);
          return { value, mutatedInput, durationMs: Date.now() - start };
        }

        if (Date.now() > deadline) {
          throw new SandboxError(
            `${args.origin.kind} '${args.origin.name}' exceeded timeout of ${args.timeoutMs}ms (after ${pumps} pump iterations)`,
          );
        }
        // Progress this pump → reset to the fast path; genuinely idle → ramp the
        // counter so the next yield backs off.
        idle = pending.value > 0 ? 0 : idle + 1;
        pumps++;
      }
    } finally {
      // If the body left a transaction open — it threw between begin and
      // commit/rollback, or the deadline cut the pump loop off while a tx was
      // live — roll it back before tearing down the VM, so the driver
      // connection isn't leaked with a half-applied transaction. Best-effort:
      // the script result (success or the original error) is already decided;
      // a rollback failure here must not mask it.
      if (txState.open && txState.handle != null) {
        const apiTx = args.ctx.api as Record<string, unknown> | undefined;
        const rollback = apiTx?.rollbackTransaction;
        if (typeof rollback === 'function') {
          try {
            await (rollback as (h: unknown) => Promise<void>).call(apiTx, txState.handle);
          } catch {
            /* best-effort cleanup — swallow so the real outcome surfaces */
          }
        }
      }
      // newAsyncContext() owns its WASM module; disposing the context disposes
      // the runtime + module together.
      vm.dispose();
    }
  }

  /**
   * Install ctx onto the VM's globalThis. Each capability is wired in only if
   * the body declared it; missing methods throw at call-time inside the VM
   * with a clear diagnostic.
   *
   * Host API methods are installed as deferred-promise functions (see
   * {@link installApiMethod}) so they may return Promises (real ObjectQL
   * `find/count/insert/...` are async) without asyncify's single-unwind limit.
   */
  private installCtx(
    vm: QuickJSAsyncContext,
    ctx: ScriptContext,
    caps: Set<HookBodyCapability>,
    origin: ScriptOrigin,
    txState: TxState,
  ): void {
    setGlobalJson(vm, '__input', ctx.input);
    setGlobalJson(vm, '__previous', ctx.previous);

    const ctxObj = vm.newObject();
    setObjectJson(vm, ctxObj, 'input', ctx.input);
    setObjectJson(vm, ctxObj, 'previous', ctx.previous);
    setObjectJson(vm, ctxObj, 'user', ctx.user);
    setObjectJson(vm, ctxObj, 'session', ctx.session);
    if (typeof ctx.event === 'string') {
      const evH = vm.newString(ctx.event);
      vm.setProp(ctxObj, 'event', evH);
      evH.dispose();
    }
    if (typeof ctx.object === 'string') {
      const obH = vm.newString(ctx.object);
      vm.setProp(ctxObj, 'object', obH);
      obH.dispose();
    }
    if (typeof ctx.recordId === 'string') {
      const idH = vm.newString(ctx.recordId);
      vm.setProp(ctxObj, 'recordId', idH);
      idH.dispose();
    }
    if (ctx.record !== undefined) {
      setObjectJson(vm, ctxObj, 'record', ctx.record);
    }
    if (ctx.result !== undefined) {
      setObjectJson(vm, ctxObj, 'result', ctx.result);
    }

    const apiObj = vm.newObject();
    const objectFn = vm.newFunction('object', (nameH) => {
      const objectName = vm.getString(nameH);
      const wrap = vm.newObject();
      const READ = ['find', 'findOne', 'count', 'aggregate'] as const;
      const WRITE = ['insert', 'update', 'delete', 'updateMany', 'deleteMany', 'upsert'] as const;
      for (const m of READ) installApiMethod(vm, wrap, m, objectName, ctx, caps, 'api.read', origin, txState);
      for (const m of WRITE) installApiMethod(vm, wrap, m, objectName, ctx, caps, 'api.write', origin, txState);
      return wrap;
    });
    vm.setProp(apiObj, 'object', objectFn);
    objectFn.dispose();

    // Transaction control. The VM-facing surface is a single `ctx.api.transaction(fn)`
    // (defined as JS sugar below); under the hood it drives three host leaves so
    // begin / commit / rollback each settle through the same deferred-promise +
    // pump mechanism every other host call uses (asyncify can't unwind twice).
    //
    // The handle is threaded EXPLICITLY through `txState` rather than via the
    // engine's ambient AsyncLocalStorage: the body runs across many host
    // event-loop turns, and ALS context does not survive those `setImmediate`
    // boundaries. While a tx is open, `installApiMethod` resolves its repository
    // from `txState.api` (the tx-scoped ScopedContext) so every op reuses the
    // one connection.
    const apiTx = ctx.api as Record<string, unknown> | undefined;
    const installTxLeaf = (name: string, run: () => Promise<void>): void => {
      const fn = vm.newFunction(name, () => {
        if (!caps.has('api.transaction')) {
          throw new SandboxError(
            `capability 'api.transaction' not granted to ${origin.kind} '${origin.name}' (called ctx.api.transaction)`,
          );
        }
        const deferred = vm.newPromise();
        void (async () => {
          try {
            await run();
            if (!vm.alive) return;
            deferred.resolve(vm.undefined);
          } catch (err) {
            if (!vm.alive) return;
            const errH =
              err instanceof Error
                ? vm.newError({ name: err.name || 'Error', message: err.message })
                : vm.newError({ name: 'Error', message: String(err) });
            deferred.reject(errH);
            errH.dispose();
          }
        })();
        return deferred.handle;
      });
      vm.setProp(apiObj, name, fn);
      fn.dispose();
    };

    installTxLeaf('__txBegin', async () => {
      if (txState.open) throw new SandboxError('nested ctx.api.transaction is not supported');
      const begin = apiTx?.beginTransaction;
      if (typeof begin === 'function') {
        const r = (await (begin as () => Promise<{ ctx: unknown; handle: unknown } | null>).call(apiTx)) ?? null;
        if (r) {
          txState.api = r.ctx as Record<string, unknown>;
          txState.handle = r.handle;
        }
      }
      // else (or null result): driver without tx support → degrade to
      // non-transactional execution, same as ScopedContext.transaction().
      txState.open = true;
    });

    installTxLeaf('__txCommit', async () => {
      const { handle, open } = txState;
      txState.api = null;
      txState.handle = null;
      txState.open = false;
      const commit = apiTx?.commitTransaction;
      if (open && handle != null && typeof commit === 'function') {
        await (commit as (h: unknown) => Promise<void>).call(apiTx, handle);
      }
    });

    installTxLeaf('__txRollback', async () => {
      const { handle, open } = txState;
      txState.api = null;
      txState.handle = null;
      txState.open = false;
      const rollback = apiTx?.rollbackTransaction;
      if (open && handle != null && typeof rollback === 'function') {
        await (rollback as (h: unknown) => Promise<void>).call(apiTx, handle);
      }
    });

    vm.setProp(ctxObj, 'api', apiObj);
    apiObj.dispose();

    const logObj = vm.newObject();
    for (const level of ['info', 'warn', 'error'] as const) {
      const fn = vm.newFunction(level, (msgH, dataH) => {
        if (!caps.has('log')) {
          throw new SandboxError(`capability 'log' not granted to ${origin.kind} '${origin.name}'`);
        }
        const msg = vm.getString(msgH);
        const data = dataH ? safeJsonParse(vm.getString(dataH)) : undefined;
        ctx.log?.[level]?.(msg, data);
        return vm.undefined;
      });
      vm.setProp(logObj, level, fn);
      fn.dispose();
    }
    vm.setProp(ctxObj, 'log', logObj);
    logObj.dispose();

    const cryptoObj = vm.newObject();
    const uuidFn = vm.newFunction('randomUUID', () => {
      if (!caps.has('crypto.uuid')) {
        throw new SandboxError(`capability 'crypto.uuid' not granted to ${origin.kind} '${origin.name}'`);
      }
      const v = ctx.crypto?.randomUUID?.() ?? cryptoRandomUUID();
      return vm.newString(v);
    });
    vm.setProp(cryptoObj, 'randomUUID', uuidFn);
    uuidFn.dispose();
    vm.setProp(ctxObj, 'crypto', cryptoObj);
    cryptoObj.dispose();

    vm.setProp(vm.global, '__ctx', ctxObj);
    ctxObj.dispose();

    // VM-side sugar: `ctx.api.transaction(async () => { … })`. Begin runs
    // OUTSIDE the try so a begin failure (e.g. missing capability) propagates
    // without attempting a rollback there is no transaction for. The body's
    // return value is forwarded; any throw triggers rollback then re-throws,
    // so the caller observes the original error.
    const sugar = vm.evalCode(
      `__ctx.api.transaction = async function (fn) {
         await __ctx.api.__txBegin();
         try {
           var r = await fn();
           await __ctx.api.__txCommit();
           return r;
         } catch (e) {
           await __ctx.api.__txRollback();
           throw e;
         }
       };`,
    );
    if (sugar.error) {
      const msg = vm.dump(sugar.error);
      sugar.error.dispose();
      throw new SandboxError(`failed to install ctx.api.transaction: ${formatErr(msg)}`);
    }
    sugar.value.dispose();
  }
}

/**
 * Per-invocation transaction state shared between {@link QuickJSScriptRunner.execute}
 * (which rolls back a tx the body left open) and the `ctx.api.transaction`
 * host leaves (which open/close it). `api` is the tx-scoped ScopedContext that
 * `installApiMethod` routes repository ops through while a tx is live; `handle`
 * is the driver transaction handle; `open` guards against nesting and tells the
 * finally block whether cleanup is owed.
 */
interface TxState {
  api: Record<string, unknown> | null;
  handle: unknown;
  open: boolean;
}

/**
 * Host-bound API method, exposed to the VM as an async function.
 *
 * IMPORTANT: this deliberately does NOT use `newAsyncifiedFunction`. Asyncify
 * unwinds the WASM stack while a host call is in flight, and the engine forbids
 * one asyncified call from running while another is unwound ("the stack cannot
 * be unwound twice"). A script that awaits two host calls in sequence — e.g. the
 * real `lead_apply_convert` action doing `findOne()` then `update()` — trips
 * exactly that: the second call is driven from a resumed continuation inside
 * `executePendingJobs` (a non-async frame), which corrupted the wasm heap
 * (`memory access out of bounds` / `p->ref_count == 0`) and, when it limped
 * along, blew the pump budget ("did not resolve after 1000 pump iterations").
 *
 * Instead we hand the VM a real QuickJS promise (a deferred) and settle it from
 * the host event loop. Sequential `await`s are then ordinary promises with no
 * stack unwinding, so any number of host calls compose safely; the pump loop in
 * {@link QuickJSScriptRunner.execute} drains the resulting jobs.
 *
 * The capability check runs synchronously at call time and surfaces inside the
 * VM as a thrown error with a clear diagnostic.
 */
function installApiMethod(
  vm: QuickJSAsyncContext,
  parent: QuickJSHandle,
  method: string,
  objectName: string,
  ctx: ScriptContext,
  caps: Set<HookBodyCapability>,
  required: HookBodyCapability,
  origin: ScriptOrigin,
  txState: TxState,
): void {
  const fn = vm.newFunction(method, (...argHandles) => {
    // Capability gate — throw synchronously so the VM sees a normal exception at
    // the call site (mirrors ctx.log / ctx.crypto gating).
    if (!caps.has(required)) {
      throw new SandboxError(
        `capability '${required}' not granted to ${origin.kind} '${origin.name}' (called ctx.api.object('${objectName}').${method})`,
      );
    }
    const apiAny = ctx.api as Record<string, unknown> | undefined;
    if (!apiAny || typeof apiAny.object !== 'function') {
      throw new SandboxError(`ctx.api unavailable in ${origin.kind} '${origin.name}'`);
    }
    // Dump args now, while the handles are alive — they are freed when this
    // function returns, long before the async work below runs.
    const args = argHandles.map((h) => vm.dump(h));

    const deferred = vm.newPromise();
    void (async () => {
      try {
        // While a transaction is open, resolve the repository from the
        // tx-scoped context so this op reuses the transaction's connection;
        // otherwise use the base ctx.api. Read `txState` HERE (at call time,
        // inside the async body) — the tx may have opened after this method
        // was installed.
        const source = (txState.api ?? apiAny) as Record<string, unknown>;
        const proxy = (source.object as (n: string) => Record<string, unknown>)(objectName);
        const m = proxy[method] as ((...a: unknown[]) => unknown) | undefined;
        if (typeof m !== 'function') {
          throw new SandboxError(`ctx.api.object('${objectName}').${method} not implemented`);
        }
        const ret = await Promise.resolve(m.apply(proxy, args));
        if (!vm.alive) return; // VM disposed (e.g. timed out) before we settled.
        const h = jsonToHandle(vm, ret);
        deferred.resolve(h);
        h.dispose();
      } catch (err) {
        if (!vm.alive) return;
        const errH =
          err instanceof Error
            ? vm.newError({ name: err.name || 'Error', message: err.message })
            : vm.newError({ name: 'Error', message: String(err) });
        deferred.reject(errH);
        errH.dispose();
      }
    })();
    // The pump loop is the sole driver of executePendingJobs, so the resolution
    // propagates into the VM on a subsequent pump iteration — no nudge here, to
    // avoid any re-entrant executePendingJobs.
    return deferred.handle;
  });
  vm.setProp(parent, method, fn);
  fn.dispose();
}

/**
 * Serialise a host value for marshalling into the VM, tolerating shapes that
 * plain `JSON.stringify` chokes on. Only JSON-safe leaves cross the sandbox
 * boundary anyway, so anything unserialisable is dropped rather than fatal:
 *
 * - **Circular references** — a live `setTimeout`/`setInterval` handle (or any
 *   node host object) reachable from `ctx` links back on itself
 *   (`Timeout._idlePrev -> TimersList._idleNext -> …`). Naive `JSON.stringify`
 *   throws `TypeError: Converting circular structure to JSON` and takes the
 *   whole hook down (issue #2674). A `WeakSet` of ancestors on the current path
 *   drops the back-edge instead.
 * - **BigInt** — `JSON.stringify` throws outright; we coerce to a string.
 *
 * The replacer is deliberately conservative: it strips only what would crash
 * the serialiser, leaving legitimate data intact.
 */
function safeJsonStringify(v: unknown): string {
  const seen = new WeakSet<object>();
  const json = JSON.stringify(v ?? null, function (this: unknown, _key, value) {
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return undefined; // drop circular back-edge
      seen.add(value);
    }
    return value;
  });
  // `JSON.stringify` returns `undefined` when the top-level value is itself
  // unserialisable (e.g. a bare function); normalise to a JSON literal so the
  // downstream `vm.evalCode` never receives `(undefined)`.
  return json ?? 'null';
}

/** Marshal a host JSON-serializable value into a QuickJS handle. */
function jsonToHandle(vm: QuickJSAsyncContext, v: unknown): QuickJSHandle {
  const json = safeJsonStringify(v);
  const r = vm.evalCode(`(${json})`);
  if (r.error) {
    const msg = vm.dump(r.error);
    r.error.dispose();
    throw new SandboxError(`failed to marshal host value: ${formatErr(msg)}`);
  }
  return r.value;
}

function setGlobalJson(vm: QuickJSAsyncContext, name: string, v: unknown): void {
  const json = safeJsonStringify(v);
  const result = vm.evalCode(`(${json})`);
  if (result.error) {
    result.error.dispose();
    return;
  }
  vm.setProp(vm.global, name, result.value);
  result.value.dispose();
}

function setObjectJson(vm: QuickJSAsyncContext, parent: QuickJSHandle, key: string, v: unknown): void {
  const json = safeJsonStringify(v);
  const result = vm.evalCode(`(${json})`);
  if (result.error) {
    result.error.dispose();
    vm.setProp(parent, key, vm.null);
    return;
  }
  vm.setProp(parent, key, result.value);
  result.value.dispose();
}

/**
 * After the script has settled, dump `globalThis.__ctx.input` so the host can
 * write through any direct property mutations the script performed (e.g.
 * `ctx.input.account_number = 'ABC'`).
 *
 * Returns `undefined` if the read fails for any reason — callers fall back to
 * the script's return value in that case.
 */
function readCtxInputJson(vm: QuickJSAsyncContext): Record<string, unknown> | undefined {
  try {
    const r = vm.evalCode(`JSON.stringify(globalThis.__ctx && globalThis.__ctx.input || null)`);
    if (r.error) {
      r.error.dispose();
      return undefined;
    }
    const s = vm.dump(r.value);
    r.value.dispose();
    if (typeof s !== 'string' || s === 'null') return undefined;
    const parsed = safeJsonParse(s);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function safeJsonParse(s: string | undefined): unknown {
  if (s === undefined || s === '') return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function cryptoRandomUUID(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  // RFC 4122 v4 fallback
  const r = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `${r()}-${r().slice(0, 4)}-4${r().slice(0, 3)}-${r().slice(0, 4)}-${r()}${r().slice(0, 4)}`;
}

function formatErr(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as { message?: string; name?: string; stack?: string };
    if (o.message) return `${o.name ?? 'Error'}: ${o.message}`;
    return JSON.stringify(err);
  }
  return String(err);
}

export class SandboxError extends Error {
  /**
   * For errors thrown by *user* script/hook/action code: the original business
   * message without the `<kind> '<name>' threw:` debug wrapper that lives in
   * `.message`. Safe to surface to end users (e.g. an action's error toast);
   * the wrapped `.message` stays for server logs. Undefined for the sandbox's
   * own internal errors (capability denials, timeouts, marshalling failures),
   * which have no user-meaningful inner message.
   */
  readonly innerMessage?: string;
  constructor(message: string, innerMessage?: string) {
    super(message);
    this.name = 'SandboxError';
    this.innerMessage = innerMessage;
  }
}

/**
 * Strip a leading default `Error: ` name prefix so a thrown business message
 * (`new Error('线索信息不完整…')`) reads as plain text for end users. Non-default
 * names (`TypeError:`, `RangeError:`) are kept — they signal a genuine bug
 * rather than a deliberately thrown business rule, which is useful context.
 */
function userFacingMessage(raw: string): string {
  return raw.startsWith('Error: ') ? raw.slice('Error: '.length) : raw;
}
