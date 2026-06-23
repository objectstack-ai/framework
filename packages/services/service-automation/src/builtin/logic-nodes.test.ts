// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';
import { AutomationEngine } from '../engine.js';
import { registerLogicNodes } from './logic-nodes.js';

function createTestLogger() {
    return {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
        child: () => createTestLogger(),
    } as any;
}

function createCtx() {
    return { logger: createTestLogger(), getService: () => undefined } as any;
}

/**
 * A one-`assignment`-node flow. `outputs` are declared as flow output variables
 * so the assigned values surface on {@link AutomationResult.output}.
 */
function assignmentFlow(config: Record<string, unknown>, outputs: string[] = ['approval_path']) {
    return {
        name: 'assign_flow',
        label: 'Assign Flow',
        type: 'autolaunched' as const,
        variables: outputs.map((name) => ({ name, type: 'text', isOutput: true })),
        nodes: [
            { id: 'start', type: 'start' as const, label: 'Start' },
            { id: 'assign', type: 'assignment' as const, label: 'Set variables', config },
            { id: 'end', type: 'end' as const, label: 'End' },
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'assign' },
            { id: 'e2', source: 'assign', target: 'end' },
        ],
    };
}

describe('assignment node — config-shape parity (Studio + examples)', () => {
    let engine: AutomationEngine;

    beforeEach(() => {
        engine = new AutomationEngine(createTestLogger());
        registerLogicNodes(engine, createCtx());
    });

    // The shape the Studio visual builder's Assignment editor emits:
    //   config: { assignments: { <var>: <value> } }
    it('sets the variable from the Studio `assignments` map shape', async () => {
        engine.registerFlow('assign_flow', assignmentFlow({ assignments: { approval_path: 'Manager OK' } }));
        const result = await engine.execute('assign_flow', {} as any);
        expect(result.success).toBe(true);
        expect(result.output).toEqual({ approval_path: 'Manager OK' });
    });

    // The shape the bundled example flows emit (app-crm, showcase):
    //   config: { assignments: [{ variable, value }] }
    it('sets variables from the `assignments` array shape', async () => {
        engine.registerFlow('assign_flow', assignmentFlow({
            assignments: [{ variable: 'approval_path', value: 'Director sign-off' }],
        }));
        const result = await engine.execute('assign_flow', {} as any);
        expect(result.output).toEqual({ approval_path: 'Director sign-off' });
    });

    // The legacy flat top-level shape (config keys ARE the variables) still works.
    it('still supports the flat key->value shape', async () => {
        engine.registerFlow('assign_flow', assignmentFlow({ approval_path: 'Flat works' }));
        const result = await engine.execute('assign_flow', {} as any);
        expect(result.output).toEqual({ approval_path: 'Flat works' });
    });

    // Values interpolate {var} against live flow variables, like CRUD/screen nodes.
    it('interpolates {var} references in assignment values', async () => {
        const flow = assignmentFlow({ assignments: { greeting: 'Hello {name}' } }, ['greeting']);
        flow.variables.push({ name: 'name', type: 'text', isInput: true } as any);
        engine.registerFlow('assign_flow', flow);
        const result = await engine.execute('assign_flow', { params: { name: 'Ada' } } as any);
        expect(result.output).toEqual({ greeting: 'Hello Ada' });
    });
});
