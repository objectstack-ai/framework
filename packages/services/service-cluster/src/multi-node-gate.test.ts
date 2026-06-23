// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
import { describe, it, expect, afterEach } from 'vitest';
import {
    registerMultiNodeGate,
    checkMultiNodeAllowed,
    __resetMultiNodeGate,
} from './multi-node-gate.js';

afterEach(() => __resetMultiNodeGate());

describe('multi-node gate', () => {
    it('allows when no gate is registered (open framework)', () => {
        expect(checkMultiNodeAllowed()).toEqual({ allowed: true });
    });

    it('honors a denying gate with reason', () => {
        registerMultiNodeGate({ allowMultiNode: () => ({ allowed: false, reason: 'unlicensed' }) });
        expect(checkMultiNodeAllowed()).toEqual({ allowed: false, reason: 'unlicensed' });
    });

    it('honors an allowing gate', () => {
        registerMultiNodeGate({ allowMultiNode: () => ({ allowed: true }) });
        expect(checkMultiNodeAllowed().allowed).toBe(true);
    });

    it('last registration wins', () => {
        registerMultiNodeGate({ allowMultiNode: () => ({ allowed: false }) });
        registerMultiNodeGate({ allowMultiNode: () => ({ allowed: true }) });
        expect(checkMultiNodeAllowed().allowed).toBe(true);
    });

    it('reset restores open default', () => {
        registerMultiNodeGate({ allowMultiNode: () => ({ allowed: false }) });
        __resetMultiNodeGate();
        expect(checkMultiNodeAllowed()).toEqual({ allowed: true });
    });
});
