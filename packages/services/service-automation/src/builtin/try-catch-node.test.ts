// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';
import { AutomationEngine } from '../engine.js';
import type { NodeExecutor } from '../engine.js';
import { registerTryCatchNode } from './try-catch-node.js';

function silentLogger() {
  return { info() {}, warn() {}, error() {}, debug() {}, child() { return silentLogger(); } } as any;
}
function ctx() {
  return { logger: silentLogger(), getService() { throw new Error('none'); } } as any;
}

describe('try/catch/retry executor (ADR-0031)', () => {
  let engine: AutomationEngine;
  let ran: string[];
  let attempts: number;

  beforeEach(() => {
    engine = new AutomationEngine(silentLogger());
    ran = [];
    attempts = 0;
    registerTryCatchNode(engine, ctx());

    engine.registerNodeExecutor({
      type: 'ok',
      async execute(node) { ran.push((node.config as any)?.tag ?? 'ok'); return { success: true }; },
    } as NodeExecutor);

    // Always fails.
    engine.registerNodeExecutor({
      type: 'boom',
      async execute() { ran.push('boom'); return { success: false, error: 'kaboom' }; },
    } as NodeExecutor);

    // Fails the first N times (config.failTimes), then succeeds — for retry tests.
    engine.registerNodeExecutor({
      type: 'flaky',
      async execute(node) {
        attempts++;
        const failTimes = Number((node.config as any)?.failTimes ?? 0);
        ran.push(`flaky#${attempts}`);
        if (attempts <= failTimes) return { success: false, error: `transient ${attempts}` };
        return { success: true };
      },
    } as NodeExecutor);

    // Reads the caught error variable.
    engine.registerNodeExecutor({
      type: 'handler',
      async execute(node, variables) {
        const v = (node.config as any)?.errVar ?? '$error';
        ran.push(`handler:${JSON.stringify(variables.get(v))}`);
        return { success: true };
      },
    } as NodeExecutor);
  });

  const tcFlow = (tcConfig: Record<string, unknown>) => ({
    name: 'tc_flow',
    label: 'TryCatch Flow',
    type: 'autolaunched' as const,
    nodes: [
      { id: 'start', type: 'start', label: 'Start' },
      { id: 'tc', type: 'try_catch', label: 'Guarded', config: tcConfig },
      { id: 'after', type: 'ok', label: 'After', config: { tag: 'after' } },
      { id: 'end', type: 'end', label: 'End' },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'tc' },
      { id: 'e2', source: 'tc', target: 'after' },
      { id: 'e3', source: 'after', target: 'end' },
    ],
  });

  it('runs the try region and continues when it succeeds (no catch invoked)', async () => {
    engine.registerFlow('tc_flow', tcFlow({
      try: { nodes: [{ id: 't', type: 'ok', label: 'T', config: { tag: 'try' } }], edges: [] },
      catch: { nodes: [{ id: 'c', type: 'ok', label: 'C', config: { tag: 'catch' } }], edges: [] },
    }));

    const result = await engine.execute('tc_flow');
    expect(result.success).toBe(true);
    expect(ran).toEqual(['try', 'after']); // catch not run, downstream continued
  });

  it('runs the catch region when the try region fails, binding the error', async () => {
    engine.registerFlow('tc_flow', tcFlow({
      try: { nodes: [{ id: 't', type: 'boom', label: 'T' }], edges: [] },
      catch: { nodes: [{ id: 'c', type: 'handler', label: 'C' }], edges: [] },
    }));

    const result = await engine.execute('tc_flow');
    expect(result.success).toBe(true); // error handled by catch
    expect(ran[0]).toBe('boom');
    expect(ran.some(r => r.startsWith('handler:') && r.includes('kaboom'))).toBe(true);
    expect(ran[ran.length - 1]).toBe('after'); // downstream continued after catch
  });

  it('retries the try region with backoff and succeeds without running catch', async () => {
    engine.registerFlow('tc_flow', tcFlow({
      try: { nodes: [{ id: 't', type: 'flaky', label: 'T', config: { failTimes: 2 } }], edges: [] },
      catch: { nodes: [{ id: 'c', type: 'boom', label: 'C' }], edges: [] },
      retry: { maxRetries: 3, retryDelayMs: 0 },
    }));

    const result = await engine.execute('tc_flow');
    expect(result.success).toBe(true);
    expect(attempts).toBe(3); // failed twice, succeeded on the third
    expect(ran).not.toContain('boom'); // catch never ran
    expect(ran[ran.length - 1]).toBe('after');
  });

  it('falls through to catch after exhausting retries', async () => {
    engine.registerFlow('tc_flow', tcFlow({
      try: { nodes: [{ id: 't', type: 'flaky', label: 'T', config: { failTimes: 99 } }], edges: [] },
      catch: { nodes: [{ id: 'c', type: 'ok', label: 'C', config: { tag: 'catch' } }], edges: [] },
      retry: { maxRetries: 2, retryDelayMs: 0 },
    }));

    const result = await engine.execute('tc_flow');
    expect(result.success).toBe(true);
    expect(attempts).toBe(3); // initial + 2 retries
    expect(ran).toContain('catch');
  });

  it('fails the node when the try region fails and there is no catch', async () => {
    engine.registerFlow('tc_flow', tcFlow({
      try: { nodes: [{ id: 't', type: 'boom', label: 'T' }], edges: [] },
    }));

    const result = await engine.execute('tc_flow');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/try region failed.*kaboom/);
    expect(ran).not.toContain('after'); // downstream did not run
  });

  it('fails the node when the catch region itself fails', async () => {
    engine.registerFlow('tc_flow', tcFlow({
      try: { nodes: [{ id: 't', type: 'boom', label: 'T' }], edges: [] },
      catch: { nodes: [{ id: 'c', type: 'boom', label: 'C' }], edges: [] },
    }));

    const result = await engine.execute('tc_flow');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/catch region failed/);
  });

  it('rejects a malformed try region at registerFlow', () => {
    expect(() =>
      engine.registerFlow('bad_tc', tcFlow({
        // two entry/exit nodes, no edges → not single-entry/single-exit
        try: { nodes: [{ id: 'a', type: 'ok', label: 'A' }, { id: 'b', type: 'ok', label: 'B' }], edges: [] },
      })),
    ).toThrow(/try_catch 'tc' try/);
  });

  it('runs a multi-node try region in order', async () => {
    engine.registerFlow('tc_flow', tcFlow({
      try: {
        nodes: [
          { id: 't1', type: 'ok', label: 'T1', config: { tag: 't1' } },
          { id: 't2', type: 'ok', label: 'T2', config: { tag: 't2' } },
        ],
        edges: [{ id: 'te', source: 't1', target: 't2' }],
      },
    }));

    const result = await engine.execute('tc_flow');
    expect(result.success).toBe(true);
    expect(ran).toEqual(['t1', 't2', 'after']);
  });
});
