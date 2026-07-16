// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppPlugin } from './app-plugin';
import type { PluginContext } from '@objectstack/core';

/**
 * #2996 — AppPlugin emits `app:seeded` when its inline seed settles, so
 * reconcilers that read seeded rows (plugin-auth's ADR-0093 D6 membership
 * backfill) can re-run for users inserted by a seed that overran the inline
 * budget and finished in the background AFTER `kernel:ready`.
 *
 * These tests force the basic-insert fallback path (no `metadata` service) so
 * the SeedLoaderService plumbing is unnecessary — the settle signalling is the
 * same on both branches.
 */
describe('AppPlugin inline-seed settle signal (app:seeded, #2996)', () => {
    const OLD_BUDGET = process.env.OS_INLINE_SEED_BUDGET_MS;
    const OLD_MULTI = process.env.OS_MULTI_ORG_ENABLED;

    let trigger: ReturnType<typeof vi.fn>;
    let insert: ReturnType<typeof vi.fn>;

    const makeContext = (overrides: Partial<PluginContext> = {}): PluginContext =>
        ({
            logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
            registerService: vi.fn(),
            getService: vi.fn((name: string) => {
                if (name === 'objectql') return { insert };
                // `metadata` absent → basic-insert fallback; all others absent too.
                return undefined;
            }),
            getServices: vi.fn(() => new Map()),
            hook: vi.fn(),
            trigger,
            ...overrides,
        }) as unknown as PluginContext;

    const bundleWithUser = () => ({
        id: 'seed-test-app',
        data: [{ object: 'sys_user', records: [{ id: 'seeded_u1' }] }],
    });

    beforeEach(() => {
        delete process.env.OS_MULTI_ORG_ENABLED;
        trigger = vi.fn();
    });

    afterEach(() => {
        if (OLD_BUDGET === undefined) delete process.env.OS_INLINE_SEED_BUDGET_MS;
        else process.env.OS_INLINE_SEED_BUDGET_MS = OLD_BUDGET;
        if (OLD_MULTI === undefined) delete process.env.OS_MULTI_ORG_ENABLED;
        else process.env.OS_MULTI_ORG_ENABLED = OLD_MULTI;
    });

    it('emits app:seeded with overBudget=true after a background seed finishes past the budget', async () => {
        process.env.OS_INLINE_SEED_BUDGET_MS = '10';
        // Insert resolves well after the 10ms budget, so the race yields to the
        // budget and the seed continues in the background.
        insert = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 60)));
        const ctx = makeContext();
        const plugin = new AppPlugin(bundleWithUser());

        await plugin.start(ctx);

        // start() returned once the budget elapsed — the background seed (and
        // thus the settle signal) has NOT fired yet.
        expect(trigger).not.toHaveBeenCalledWith('app:seeded', expect.anything());

        await vi.waitFor(() => {
            expect(trigger).toHaveBeenCalledWith('app:seeded', {
                appId: 'seed-test-app',
                overBudget: true,
            });
        });
        // The user was still inserted by the background seed.
        expect(insert).toHaveBeenCalledWith('sys_user', { id: 'seeded_u1' }, expect.anything());
    });

    it('emits app:seeded with overBudget=false when the seed completes within budget', async () => {
        process.env.OS_INLINE_SEED_BUDGET_MS = '8000';
        insert = vi.fn(async () => undefined); // resolves immediately
        const ctx = makeContext();
        const plugin = new AppPlugin(bundleWithUser());

        await plugin.start(ctx);

        expect(trigger).toHaveBeenCalledWith('app:seeded', {
            appId: 'seed-test-app',
            overBudget: false,
        });
    });

    it('does not emit app:seeded when the app has no seed datasets', async () => {
        insert = vi.fn(async () => undefined);
        const ctx = makeContext();
        const plugin = new AppPlugin({ id: 'seed-test-app' });

        await plugin.start(ctx);

        expect(trigger).not.toHaveBeenCalledWith('app:seeded', expect.anything());
    });

    it('does not throw when the kernel context has no trigger() function', async () => {
        process.env.OS_INLINE_SEED_BUDGET_MS = '8000';
        insert = vi.fn(async () => undefined);
        const ctx = makeContext({ trigger: undefined as any });
        const plugin = new AppPlugin(bundleWithUser());

        await expect(plugin.start(ctx)).resolves.toBeUndefined();
        expect(insert).toHaveBeenCalledWith('sys_user', { id: 'seeded_u1' }, expect.anything());
    });

    it('does not run the inline seed (or emit) in multi-tenant mode', async () => {
        process.env.OS_MULTI_ORG_ENABLED = 'true';
        insert = vi.fn(async () => undefined);
        const ctx = makeContext();
        const plugin = new AppPlugin(bundleWithUser());

        await plugin.start(ctx);

        expect(insert).not.toHaveBeenCalled();
        expect(trigger).not.toHaveBeenCalledWith('app:seeded', expect.anything());
    });
});
