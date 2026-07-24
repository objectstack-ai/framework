// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// accumulateSeedSummary is the shared boot-banner seed counter fed from more
// than one place (AppPlugin's config seed AND the marketplace rehydrate heal).
// The tricky part is the kernel it runs against: registerService THROWS on a
// duplicate name, and getService caches — so a naive read-modify-register loses
// the second writer's count entirely (the bug that made the marketplace heal
// invisible in the banner). These pin the register-once-then-mutate contract.

import { describe, it, expect } from 'vitest';
import { accumulateSeedSummary, SEED_SUMMARY_SERVICE } from './seed-summary.js';

/** Kernel double: registerService throws on duplicate; getService throws when absent. */
function fakeKernelCtx() {
    const services = new Map<string, any>();
    return {
        getService: (name: string) => {
            if (!services.has(name)) throw new Error(`Service '${name}' not found`);
            return services.get(name);
        },
        registerService: (name: string, value: any) => {
            if (services.has(name)) throw new Error(`Service '${name}' already registered`);
            services.set(name, value);
        },
        _peek: () => services.get(SEED_SUMMARY_SERVICE),
    };
}

describe('accumulateSeedSummary', () => {
    it('creates the counter on first use', () => {
        const ctx = fakeKernelCtx();
        accumulateSeedSummary(ctx, { inserted: 130, updated: 6 });
        expect(ctx._peek()).toEqual({ inserted: 130, updated: 6, skipped: 0, rejected: 0 });
    });

    it('ACCUMULATES a second writer instead of throwing on re-register (the marketplace-heal bug)', () => {
        const ctx = fakeKernelCtx();
        accumulateSeedSummary(ctx, { inserted: 130, updated: 6 });   // config seed
        accumulateSeedSummary(ctx, { inserted: 162 });               // marketplace heal
        // Both counts land — the second call must NOT be swallowed by the
        // kernel's "already registered" throw.
        expect(ctx._peek()).toEqual({ inserted: 292, updated: 6, skipped: 0, rejected: 0 });
    });

    it('mutates the SAME object a prior reader already holds (cache-safe)', () => {
        const ctx = fakeKernelCtx();
        accumulateSeedSummary(ctx, { inserted: 1 });
        const held = ctx.getService(SEED_SUMMARY_SERVICE); // a reader caches this reference
        accumulateSeedSummary(ctx, { rejected: 3 });
        // The already-held reference reflects the later write.
        expect(held).toEqual({ inserted: 1, updated: 0, skipped: 0, rejected: 3 });
    });

    it('sums rejected across sources so the banner warning fires on any failure', () => {
        const ctx = fakeKernelCtx();
        accumulateSeedSummary(ctx, { inserted: 130 });
        accumulateSeedSummary(ctx, { rejected: 5 });
        expect(ctx._peek().rejected).toBe(5);
    });

    it('is best-effort — never throws even when the ctx cannot store services', () => {
        const broken = {
            getService: () => { throw new Error('boom'); },
            registerService: () => { throw new Error('nope'); },
        };
        expect(() => accumulateSeedSummary(broken, { inserted: 1 })).not.toThrow();
    });

    it('tolerates a ctx missing getService/registerService entirely', () => {
        expect(() => accumulateSeedSummary({}, { inserted: 1 })).not.toThrow();
    });
});
