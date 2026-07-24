// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { recordSeedOutcome, type SeedSourceOutcome } from './seed-summary.js';

/**
 * #3415/#3430 — the boot-summary writer contract. The kernel's registerService
 * THROWS on a duplicate name, so the accumulator must register the list once and
 * then mutate the same reference in place. These tests pin that (a second source
 * on the same boot must not crash) plus the per-source merge semantics.
 */
describe('recordSeedOutcome', () => {
    /** A kernel-ish context: getService throws on miss, registerService throws on dupe. */
    function makeCtx() {
        const services = new Map<string, unknown>();
        return {
            services,
            getService: (n: string) => {
                if (!services.has(n)) throw new Error(`no service ${n}`);
                return services.get(n);
            },
            registerService: (n: string, v: unknown) => {
                if (services.has(n)) throw new Error(`[Kernel] Service '${n}' already registered`);
                services.set(n, v);
            },
        };
    }

    const out = (o: Partial<SeedSourceOutcome> & { source: string }): SeedSourceOutcome => ({
        inserted: 0, updated: 0, skipped: 0, rejected: 0, ...o,
    });

    it('registers a new summary list on the first call', () => {
        const ctx = makeCtx();
        recordSeedOutcome(ctx, out({ source: 'showcase', inserted: 42 }));
        expect(ctx.services.get('seed-summary')).toEqual([
            { source: 'showcase', inserted: 42, updated: 0, skipped: 0, rejected: 0 },
        ]);
    });

    it('appends a second source WITHOUT a duplicate-register throw', () => {
        const ctx = makeCtx();
        recordSeedOutcome(ctx, out({ source: 'showcase', inserted: 10 }));
        // registerService would throw on a second register — the helper must
        // instead mutate the list already stored under the same name.
        expect(() => recordSeedOutcome(ctx, out({ source: 'hotcrm', marketplace: true, inserted: 5 }))).not.toThrow();
        const list = ctx.services.get('seed-summary') as SeedSourceOutcome[];
        expect(list).toHaveLength(2);
        expect(list.map((e) => e.source)).toEqual(['showcase', 'hotcrm']);
    });

    it('merges counts and ORs flags for the same (source, marketplace) key', () => {
        const ctx = makeCtx();
        recordSeedOutcome(ctx, out({ source: 'hotcrm', marketplace: true, inserted: 3, rejected: 1 }));
        recordSeedOutcome(ctx, out({ source: 'hotcrm', marketplace: true, updated: 2, rejected: 4, healed: true }));
        const list = ctx.services.get('seed-summary') as SeedSourceOutcome[];
        expect(list).toHaveLength(1);
        expect(list[0]).toMatchObject({ inserted: 3, updated: 2, rejected: 5, healed: true });
    });

    it('keeps a config app and a same-named marketplace package as separate entries', () => {
        const ctx = makeCtx();
        recordSeedOutcome(ctx, out({ source: 'crm', inserted: 1 }));
        recordSeedOutcome(ctx, out({ source: 'crm', marketplace: true, inserted: 2 }));
        const list = ctx.services.get('seed-summary') as SeedSourceOutcome[];
        expect(list).toHaveLength(2);
    });

    it('never throws when the context exposes no service methods', () => {
        expect(() => recordSeedOutcome({}, out({ source: 'x', inserted: 1 }))).not.toThrow();
        expect(() => recordSeedOutcome(undefined, out({ source: 'x', inserted: 1 }))).not.toThrow();
    });
});
