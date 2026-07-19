// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * RSS soak (ADR-0102 D2). Each invocation instantiates a FRESH sync WASM module
 * (`newQuickJSWASMModule()`) for per-invocation memory isolation. Unlike the old
 * asyncify path, the sync `QuickJSWASMModule` has no `dispose()` — its WebAssembly
 * instance + linear memory are reclaimed by GC when the reference is dropped.
 *
 * This guards the one behavioural delta of dropping asyncify: many back-to-back
 * invocations must NOT ratchet RSS. A true leak (module memory never reclaimed)
 * would add hundreds of MB to GBs across a few hundred runs; GC slack is far
 * smaller than the bound. No `--expose-gc` needed — the point is that *natural*
 * GC keeps it bounded.
 */

import { describe, it, expect } from 'vitest';
import { QuickJSScriptRunner } from './quickjs-runner.js';
import type { ScriptContext, ScriptRunOptions } from './script-runner.js';

describe('QuickJSScriptRunner — RSS stays bounded across many invocations (ADR-0102 D2)', () => {
  it('does not ratchet RSS over 300 hook invocations (per-invocation modules are GC-reclaimed)', async () => {
    const runner = new QuickJSScriptRunner({ hookTimeoutMs: 10_000 });
    const api = { object: () => ({ count: async () => 7 }) };
    const opts: ScriptRunOptions = { origin: { kind: 'hook', name: 'rss' } };
    const ctx = (): ScriptContext => ({ input: { n: 1 }, api });
    const run = () =>
      runner.runScript(
        { language: 'js', source: "return { c: await ctx.api.object('x').count({}) };", capabilities: ['api.read'] },
        ctx(),
        opts,
      );

    // Warm up (module compile caches, V8 JIT) then take a baseline.
    for (let i = 0; i < 40; i++) await run();
    (globalThis as { gc?: () => void }).gc?.();
    const baseRss = process.memoryUsage().rss;

    for (let i = 0; i < 300; i++) await run();
    (globalThis as { gc?: () => void }).gc?.();
    await new Promise((r) => setTimeout(r, 100));
    const growthMb = (process.memoryUsage().rss - baseRss) / 1024 / 1024;

    // A genuine leak (fresh ~multi-MB WASM instance per run, never reclaimed)
    // would add ≳1GB over 300 runs. A generous 400MB bound distinguishes a leak
    // from GC slack / heap noise without being flaky.
    expect(growthMb, `RSS grew ${growthMb.toFixed(1)}MB over 300 runs`).toBeLessThan(400);
  }, 60000);
});
