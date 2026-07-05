// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { actionBodyRunnerFactory, QuickJSScriptRunner } from '@objectstack/runtime';

import { allActions, MarkDoneAction } from '../src/ui/actions/index.js';

/**
 * Execution-path coverage for declared actions.
 *
 * The `coverage.test.ts` check only asserts that every `ActionType` *appears*
 * in the bundle — a `type: 'script'` action with no executable handler passes
 * it. That blind spot shipped the #2169 bug: `showcase_mark_done` declared
 * `type: 'script'` but carried neither a `body` nor a `target`, so AppPlugin
 * registered no engine handler and clicking "Mark Done" failed at runtime with
 * `Action 'showcase_mark_done' on object '*' not found`.
 *
 * These tests drive the **real** runtime path — `actionBodyRunnerFactory` +
 * the QuickJS sandbox, the exact bridge AppPlugin uses — against the actions as
 * shipped. A body that fails to parse, references the wrong field, or is missing
 * entirely fails here, not in production.
 */
describe('showcase actions — executability', () => {
  const runner = new QuickJSScriptRunner();

  it('every declared `script` action is executable (has a body or a target)', () => {
    // Mirrors the platform invariant enforced by ActionSchema: a script action
    // must be bound to *something* runnable. `target` actions are wired
    // imperatively (e.g. via onEnable); `body` actions are auto-registered.
    const scriptActions = allActions.filter((a) => a.type === 'script');
    expect(scriptActions.length).toBeGreaterThan(0);
    for (const a of scriptActions) {
      expect(
        Boolean((a as { body?: unknown }).body) || Boolean((a as { target?: unknown }).target),
        `script action '${a.name}' has neither body nor target — it cannot be invoked`,
      ).toBe(true);
    }
  });

  it('the runtime produces a handler for Mark Done (regression: #2169)', () => {
    const factory = actionBodyRunnerFactory(runner, { ql: {}, appId: 'showcase' });
    const handler = factory(MarkDoneAction as never);
    expect(typeof handler).toBe('function');
  });

  it('Mark Done flips `done` + `progress` via the sandboxed body', async () => {
    // Capture what the action writes through the proxied ObjectQL engine.
    let written: { object: string; data: Record<string, unknown> } | undefined;
    const ql = {
      object: (object: string) => ({
        update: async (data: Record<string, unknown>) => {
          written = { object, data };
          return { id: data.id };
        },
      }),
    };

    const factory = actionBodyRunnerFactory(runner, { ql, appId: 'showcase' });
    const handler = factory(MarkDoneAction as never);
    expect(typeof handler).toBe('function');

    const result = await handler!({
      recordId: 'task_1',
      record: { id: 'task_1', status: 'in_progress', progress: 40, done: false },
      params: {},
      user: { id: 'u1' },
    });

    // It updates the right object with the completion fields — and deliberately
    // does NOT touch `status` (the state-machine only permits in_review -> done).
    expect(written?.object).toBe('showcase_task');
    expect(written?.data).toMatchObject({ id: 'task_1', done: true, progress: 100 });
    expect(written?.data).not.toHaveProperty('status');
    expect(result).toEqual({ ok: true, id: 'task_1' });
  });

  it('a body-less `script` action yields no handler (the #2169 failure mode)', () => {
    // Documents exactly what used to ship: with neither body nor target the
    // runtime has nothing to register, so the HTTP action route falls into the
    // wildcard fallback. ActionSchema now rejects this at author time; this
    // asserts the runtime half of the contract.
    const factory = actionBodyRunnerFactory(runner, { ql: {}, appId: 'showcase' });
    const handler = factory({ name: 'broken', object: 'showcase_task' } as never);
    expect(handler).toBeUndefined();
  });
});
