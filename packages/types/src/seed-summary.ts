// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Boot-banner seed counters (#3415 / #3430).
 *
 * Data seeding runs inside serve's boot-quiet stdout window, and SeedLoader's
 * own logs sit under the default `warn` level — so without a banner line a
 * fixture (or a marketplace package) can silently lose most of its rows. The
 * CLI reads this counter after `runtime.start()` and prints a `Seeds:` line,
 * escalating to a warning when `rejected > 0`.
 *
 * The counter is fed from more than one place — AppPlugin's config-app seed AND
 * the marketplace rehydrate heal — which is exactly why {@link accumulateSeedSummary}
 * exists: naive `registerService(name, {…})` twice THROWS ("already
 * registered"), and the plugin `getService` cache means a re-registered value
 * would be invisible to a reader that already read the old one. So we register
 * ONE mutable object and mutate it in place; every writer shares that object
 * and the CLI reads the live total.
 */

/** Running seed totals for the boot banner. */
export interface SeedSummaryCounters {
    inserted: number;
    updated: number;
    skipped: number;
    /** Records dropped by validation/reference errors — the silent-loss case. */
    rejected: number;
}

/** Kernel service name under which the shared counter object lives. */
export const SEED_SUMMARY_SERVICE = 'seed-summary';

/**
 * Add a seed outcome to the shared boot-banner counter, creating it on first
 * use. Best-effort and never throws.
 *
 * Race/ordering safety: the counter is a single object registered once (the
 * first writer wins the registration; a loser catches the "already registered"
 * throw and fetches the winner's object). Every writer then MUTATES that shared
 * object in place, so the value is correct regardless of which seed source runs
 * first and independent of the kernel's `getService` cache.
 *
 * `ctx` is a plugin context exposing `getService` / `registerService` (the
 * standard PluginContext — note it has no `.kernel` handle, so callers must not
 * reach through one).
 */
export function accumulateSeedSummary(
    ctx: { getService?: (name: string) => any; registerService?: (name: string, value: any) => void },
    delta: Partial<SeedSummaryCounters>,
): void {
    try {
        const read = (): SeedSummaryCounters | undefined => {
            // getService throws when the service is absent — treat as "none yet".
            try { return ctx.getService?.(SEED_SUMMARY_SERVICE); } catch { return undefined; }
        };
        let counter = read();
        if (!counter) {
            const fresh: SeedSummaryCounters = { inserted: 0, updated: 0, skipped: 0, rejected: 0 };
            try {
                ctx.registerService?.(SEED_SUMMARY_SERVICE, fresh);
                counter = fresh;
            } catch {
                // Lost the registration race — another writer got there first.
                // Mutate their object so both writers' counts land.
                counter = read() ?? fresh;
            }
        }
        counter.inserted += delta.inserted ?? 0;
        counter.updated += delta.updated ?? 0;
        counter.skipped += delta.skipped ?? 0;
        counter.rejected += delta.rejected ?? 0;
    } catch {
        /* best-effort — a seed summary must never break a boot */
    }
}
