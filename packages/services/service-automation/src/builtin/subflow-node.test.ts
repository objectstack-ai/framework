// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';
import { AutomationEngine } from '../engine.js';
import type { NodeExecutor } from '../engine.js';
import { registerSubflowNode } from './subflow-node.js';

function silentLogger() {
  return { info() {}, warn() {}, error() {}, debug() {}, child() { return silentLogger(); } } as any;
}
function ctx() {
  return { logger: silentLogger(), getService() { throw new Error('none'); } } as any;
}

describe('subflow node executor', () => {
  let engine: AutomationEngine;
  let ran: string[];
  let seenInput: unknown[];
  let captured: unknown[];

  beforeEach(() => {
    engine = new AutomationEngine(silentLogger());
    ran = [];
    seenInput = [];
    captured = [];
    registerSubflowNode(engine, ctx());

    // Child marker: records it ran + sets the child's declared output var.
    engine.registerNodeExecutor({
      type: 'childmark',
      async execute(_node, variables, context) {
        ran.push('child');
        seenInput.push((context as any)?.params?.msg);
        variables.set('result', 'CHILD_DONE');
        return { success: true };
      },
    } as NodeExecutor);
    // Parent checker after the subflow node: captures the mapped output var.
    engine.registerNodeExecutor({
      type: 'parentcheck',
      async execute(_node, variables) {
        captured.push(variables.get('subResult'));
        return { success: true };
      },
    } as NodeExecutor);
    // A node that suspends (to exercise the nested-pause guard).
    engine.registerNodeExecutor({
      type: 'pauser',
      async execute() { return { success: true, suspend: true }; },
    } as NodeExecutor);

    engine.registerFlow('child_flow', {
      name: 'child_flow',
      label: 'Child Flow',
      type: 'autolaunched',
      variables: [
        { name: 'msg', type: 'text', isInput: true },
        { name: 'result', type: 'text', isOutput: true },
      ],
      nodes: [
        { id: 'cs', type: 'start', label: 'Start' },
        { id: 'cm', type: 'childmark', label: 'Child Work' },
        { id: 'ce', type: 'end', label: 'End' },
      ],
      edges: [
        { id: 'c1', source: 'cs', target: 'cm' },
        { id: 'c2', source: 'cm', target: 'ce' },
      ],
    });
  });

  const parentFlow = (subConfig: Record<string, unknown>) => ({
    name: 'parent_flow',
    label: 'Parent Flow',
    type: 'autolaunched',
    variables: [{ name: 'greeting', type: 'text', isInput: true }],
    nodes: [
      { id: 'ps', type: 'start', label: 'Start' },
      { id: 'call', type: 'subflow', label: 'Call Child', config: subConfig },
      { id: 'chk', type: 'parentcheck', label: 'Check' },
      { id: 'pe', type: 'end', label: 'End' },
    ],
    edges: [
      { id: 'p1', source: 'ps', target: 'call' },
      { id: 'p2', source: 'call', target: 'chk' },
      { id: 'p3', source: 'chk', target: 'pe' },
    ],
  });

  it('invokes the child flow, maps input, and captures its output', async () => {
    engine.registerFlow('parent_flow', parentFlow({
      flowName: 'child_flow',
      input: { msg: '{greeting}' },
      outputVariable: 'subResult',
    }));

    const result = await engine.execute('parent_flow', { params: { greeting: 'hi' } });

    expect(result.success).toBe(true);
    expect(result.status).toBeUndefined(); // ran to completion
    expect(ran).toEqual(['child']); // the child flow actually executed
    expect(seenInput).toEqual(['hi']); // input mapping interpolated from parent vars
    expect(captured).toEqual([{ result: 'CHILD_DONE' }]); // child output captured into the parent var
  });

  it('fails with a clear error when flowName is missing', async () => {
    engine.registerFlow('parent_flow', parentFlow({ input: {} }));
    const result = await engine.execute('parent_flow');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/flowName is required/i);
  });

  it('fails with a clear error when the child flow is not registered', async () => {
    engine.registerFlow('parent_flow', parentFlow({ flowName: 'no_such_flow' }));
    const result = await engine.execute('parent_flow');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no_such_flow.*failed/i);
    expect(captured).toEqual([]); // downstream did not run
  });

  it('fails with a clear error when the child suspends (nested pause unsupported)', async () => {
    engine.registerFlow('paused_child', {
      name: 'paused_child',
      label: 'Paused Child',
      type: 'autolaunched',
      nodes: [
        { id: 's', type: 'start', label: 'Start' },
        { id: 'p', type: 'pauser', label: 'Pause' },
        { id: 'e', type: 'end', label: 'End' },
      ],
      edges: [
        { id: 'a', source: 's', target: 'p' },
        { id: 'b', source: 'p', target: 'e' },
      ],
    });
    engine.registerFlow('parent_flow', parentFlow({ flowName: 'paused_child' }));
    const result = await engine.execute('parent_flow');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/suspended/i);
  });

  it('guards against a recursive subflow cycle (clean error, no stack overflow)', async () => {
    // A flow that calls itself — should hit the depth cap and fail cleanly.
    engine.registerFlow('recursive_flow', {
      name: 'recursive_flow',
      label: 'Recursive Flow',
      type: 'autolaunched',
      nodes: [
        { id: 's', type: 'start', label: 'Start' },
        { id: 'self', type: 'subflow', label: 'Self', config: { flowName: 'recursive_flow' } },
        { id: 'e', type: 'end', label: 'End' },
      ],
      edges: [
        { id: 'a', source: 's', target: 'self' },
        { id: 'b', source: 'self', target: 'e' },
      ],
    });
    const result = await engine.execute('recursive_flow');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/depth|recursive/i);
  });
});
