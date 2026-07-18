// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LiteKernel } from '@objectstack/core';
import type { Plugin, PluginContext } from '@objectstack/core';

import { AutomationServicePlugin } from './plugin.js';
import type { AutomationEngine } from './engine.js';

/**
 * End-to-end coverage for the #1928 production wiring: `AutomationServicePlugin`
 * must, at `start()`, bridge the engine's object-schema resolver to the live
 * `objectql.registry.getObject`. The engine-level tests set the resolver by
 * hand; this proves the PLUGIN actually wires it from a real service and that a
 * flow registered through the running kernel gets the schema-aware advisory.
 *
 * A minimal fake `objectql` plugin supplies `registry.getObject` — the exact
 * seam the plugin consumes. Bootstrap runs every `init()` before any `start()`,
 * so the service is present when automation's `start()` looks it up.
 */
function fakeObjectqlPlugin(): Plugin {
  return {
    name: 'fake-objectql',
    version: '1.0.0',
    async init(ctx: PluginContext) {
      (ctx as unknown as { registerService(name: string, svc: unknown): void }).registerService('objectql', {
        registry: {
          getObject: (name: string) =>
            name === 'crm_opportunity'
              ? {
                  name,
                  fields: {
                    amount: { type: 'currency' },
                    title: { type: 'text' },
                    is_active: { type: 'boolean' },
                    stage: { type: 'select' },
                  },
                }
              : undefined,
        },
      });
    },
  };
}

const oppFlow = (condition: string) => ({
  name: 'opp_flow',
  label: 'Opportunity Flow',
  type: 'record_change',
  nodes: [
    { id: 'start', type: 'start', label: 'Start', config: { objectName: 'crm_opportunity' } },
    { id: 'check', type: 'decision', label: 'Check', config: { condition } },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'check' },
    { id: 'e2', source: 'check', target: 'end' },
  ],
});

describe('AutomationServicePlugin — object-schema resolver wired end-to-end (#1928)', () => {
  let kernel: LiteKernel;
  let engine: AutomationEngine;
  let stdout: string[];
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    stdout = [];
    // `warn` logs go to process.stdout (non-error level); capture without
    // forwarding so we can assert on the registration advisory.
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    }) as never);
    kernel = new LiteKernel();
    kernel.use(fakeObjectqlPlugin());
    kernel.use(new AutomationServicePlugin());
    await kernel.bootstrap();
    engine = kernel.getService('automation') as AutomationEngine;
  });

  afterEach(async () => {
    stdoutSpy.mockRestore();
    await kernel.shutdown();
  });

  it('bridges the resolver to objectql.registry.getObject (fields + types)', () => {
    const resolver = (engine as unknown as { objectSchemaResolver: ((n: string) => unknown) | null })
      .objectSchemaResolver;
    expect(typeof resolver).toBe('function');
    const schema = resolver!('crm_opportunity') as { fields: string[]; fieldTypes: Record<string, string> };
    expect(schema.fields.slice().sort()).toEqual(['amount', 'is_active', 'stage', 'title']);
    expect(schema.fieldTypes).toMatchObject({ amount: 'currency', title: 'text', is_active: 'boolean' });
    expect(resolver!('does_not_exist')).toBeUndefined();
  });

  it('emits a tier-4 advisory when a registered flow does arithmetic on a text field', () => {
    stdout.length = 0;
    expect(() => engine.registerFlow('opp_flow', oppFlow('title * 2 > 10'))).not.toThrow();
    const logged = stdout.join('');
    expect(logged).toMatch(/type mismatch/i);
    expect(logged).toMatch(/title/);
  });

  it('emits no schema advisory for a sound flow condition', () => {
    stdout.length = 0;
    engine.registerFlow('opp_flow_ok', oppFlow('stage == "won" && amount > 1000'));
    const logged = stdout.join('');
    expect(logged).not.toMatch(/type mismatch|did you mean|unknown field/i);
  });
});
