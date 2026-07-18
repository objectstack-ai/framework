// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { isPerfDisclosurePrincipal } from './http-dispatcher.js';
import type { ExecutionContext } from '@objectstack/spec/kernel';

/**
 * Unit coverage for the per-request `Server-Timing` disclosure predicate
 * (#2408). Only admin/service/system principals may pull the timing header when
 * it was opened per-request via `X-OS-Debug-Timing`; every ordinary caller must
 * read as not-allowed so sending the header leaks nothing.
 */
const ctx = (over: Partial<ExecutionContext>): ExecutionContext =>
    ({ isSystem: false, positions: [], permissions: [], ...over }) as ExecutionContext;

describe('isPerfDisclosurePrincipal', () => {
    it('denies an undefined / anonymous context', () => {
        expect(isPerfDisclosurePrincipal(undefined)).toBe(false);
        expect(isPerfDisclosurePrincipal(ctx({}))).toBe(false);
    });

    it('denies an ordinary human / guest / agent principal', () => {
        expect(isPerfDisclosurePrincipal(ctx({ principalKind: 'human' }))).toBe(false);
        expect(isPerfDisclosurePrincipal(ctx({ principalKind: 'guest' }))).toBe(false);
        expect(isPerfDisclosurePrincipal(ctx({ principalKind: 'agent' }))).toBe(false);
        // A member-rung human with permissions but no admin posture stays denied.
        expect(
            isPerfDisclosurePrincipal(ctx({ principalKind: 'human', posture: 'MEMBER' })),
        ).toBe(false);
    });

    it('allows system / service principals', () => {
        expect(isPerfDisclosurePrincipal(ctx({ isSystem: true }))).toBe(true);
        expect(isPerfDisclosurePrincipal(ctx({ principalKind: 'service' }))).toBe(true);
        expect(isPerfDisclosurePrincipal(ctx({ principalKind: 'system' }))).toBe(true);
    });

    it('allows the derived admin posture rungs', () => {
        expect(isPerfDisclosurePrincipal(ctx({ posture: 'PLATFORM_ADMIN' }))).toBe(true);
        expect(isPerfDisclosurePrincipal(ctx({ posture: 'TENANT_ADMIN' }))).toBe(true);
    });
});
