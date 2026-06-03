// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Capability loader — `bundle.requires` driven dispatch.
 *
 * Mirrors the CAPABILITY_PROVIDERS table in
 * `@objectstack/cli/src/commands/serve.ts` so that per-project kernels
 * built by {@link ArtifactKernelFactory} pick up the same service plugins
 * a developer would get when running `objectstack serve` locally.
 *
 * Design goals:
 *   - Single source of truth: artifact's `requires` array. No hardcoded
 *     plugin list per host.
 *   - Lazy: each provider is dynamically imported only when requested,
 *     keeping cold-start small for artifacts that don't need that
 *     capability.
 *   - Silent on missing deps: a host that doesn't ship the optional
 *     package (e.g. service-queue) just logs a warn and continues.
 */

import type { ObjectKernel } from '@objectstack/core';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

/**
 * Import an optional capability package, resolving it from the HOST APP's
 * context first.
 *
 * The host app (a tenant runtime like apps/objectos, or an enterprise
 * objectos-ee install) is what declares optional plugin packages — including
 * private ones such as `@objectstack/service-ai-studio` that are NOT part of
 * the framework's own dependency graph. A bare `import(pkg)` from this file
 * resolves relative to the framework package's location, which cannot see a
 * package linked into the *app's* node_modules (the failure surfaces as
 * "Cannot find package … imported from …/framework/…"). Anchoring a
 * `createRequire` at the app's cwd resolves it from the app's node_modules.
 * Falls back to a bare import for framework-owned packages.
 */
async function importFromHost(pkg: string): Promise<any> {
    try {
        const req = createRequire(join(process.cwd(), 'package.json'));
        const resolved = req.resolve(pkg);
        return await import(pathToFileURL(resolved).href);
    } catch {
        return import(/* webpackIgnore: true */ pkg);
    }
}

export interface CapabilitySpec {
    /** npm package name to import. */
    pkg: string;
    /** Named export — class constructor for the main plugin. */
    export: string;
    /**
     * Optional bundle key that, when present, is forwarded as constructor
     * argument (e.g. analytics needs `analyticsCubes`).
     */
    configKey?: string;
    /** Auxiliary plugins loaded alongside the main one. */
    extras?: Array<{ pkg: string; export: string }>;
}

/**
 * Registry of `requires` token → plugin provider.
 *
 * Keep keys in sync with the user-facing tokens accepted by
 * `defineStack({ requires: [...] })` and the CLI's CAPABILITY_PROVIDERS.
 *
 * Tier-gated capabilities (`auth`, `ui`, `i18n`) are intentionally NOT
 * listed here — they are wired explicitly by the kernel factory because
 * they need bespoke configuration (per-project HKDF secret, UI dist
 * paths, etc).
 */
export const CAPABILITY_PROVIDERS: Record<string, CapabilitySpec> = {
    automation: {
        // Self-contained: AutomationServicePlugin seeds all built-in node
        // executors itself (ADR-0018), so no companion node-pack plugins.
        pkg: '@objectstack/service-automation',
        export: 'AutomationServicePlugin',
    },
    ai: {
        pkg: '@objectstack/service-ai',
        export: 'AIServicePlugin',
    },
    // AI Studio — AI-driven metadata authoring ("online development"). This is
    // a commercial capability that ships in the private @objectstack/service-ai-studio
    // package (not part of the open-source framework). The dynamic import below
    // silently skips when the package isn't installed, so the open-source build
    // is unaffected; cloud and enterprise installs that ship the package light it
    // up. Pair with `ai` in `requires` (it attaches via the `ai:ready` hook).
    aiStudio: {
        pkg: '@objectstack/service-ai-studio',
        export: 'AIStudioPlugin',
    },
    analytics: {
        pkg: '@objectstack/service-analytics',
        export: 'AnalyticsServicePlugin',
        configKey: 'analyticsCubes',
    },
    audit: {
        pkg: '@objectstack/plugin-audit',
        export: 'AuditPlugin',
    },
    cache: {
        pkg: '@objectstack/service-cache',
        export: 'CacheServicePlugin',
    },
    storage: {
        pkg: '@objectstack/service-storage',
        export: 'StorageServicePlugin',
    },
    queue: {
        pkg: '@objectstack/service-queue',
        export: 'QueueServicePlugin',
    },
    job: {
        pkg: '@objectstack/service-job',
        export: 'JobServicePlugin',
    },
    messaging: {
        // Backs the `notify` flow node (ADR-0012): delivers to a user's
        // channels (inbox by default → `sys_inbox_message` rows).
        pkg: '@objectstack/service-messaging',
        export: 'MessagingServicePlugin',
    },
    triggers: {
        // Concrete flow triggers — record-change (ObjectQL hooks) + schedule
        // (cron/interval via the job service; pair `triggers` with `job`).
        pkg: '@objectstack/plugin-trigger-record-change',
        export: 'RecordChangeTriggerPlugin',
        extras: [{ pkg: '@objectstack/plugin-trigger-schedule', export: 'ScheduleTriggerPlugin' }],
    },
    realtime: {
        pkg: '@objectstack/service-realtime',
        export: 'RealtimeServicePlugin',
    },
    feed: {
        pkg: '@objectstack/service-feed',
        export: 'FeedServicePlugin',
    },
    settings: {
        pkg: '@objectstack/service-settings',
        export: 'SettingsServicePlugin',
    },
};

type Logger = { info?: (...a: any[]) => void; warn?: (...a: any[]) => void; error?: (...a: any[]) => void };

export interface LoadCapabilitiesOptions {
    kernel: ObjectKernel;
    /** Tokens from `bundle.requires` (e.g. `['ai','automation','analytics']`). */
    requires: readonly string[];
    /** Compiled artifact metadata. Used to pull `configKey`-driven args. */
    bundle: Record<string, unknown>;
    /** Optional logger. */
    logger?: Logger;
    /** environmentId for log breadcrumbs. */
    environmentId: string;
}

/**
 * Walk `requires` and install each known capability on the kernel.
 *
 * Returns the list of plugin exports actually installed for diagnostics.
 */
export async function loadCapabilities(opts: LoadCapabilitiesOptions): Promise<string[]> {
    const { kernel, requires, bundle, environmentId } = opts;
    const logger: Logger = opts.logger ?? console;
    const installed: string[] = [];

    // De-dupe, then ensure dependent capabilities are present. ADR-0030:
    // collaboration notifications (audit @mention/assignment) and the bell now
    // deliver through the messaging pipeline, so `messaging` must load whenever
    // `audit` does — otherwise those notifications silently no-op on cloud
    // per-project kernels (which, unlike `objectstack serve`, have no
    // always-on capability slate). Mirrors the CLI's foundational defaults.
    const resolved = [...new Set(requires)];
    if (resolved.includes('audit') && !resolved.includes('messaging')) {
        resolved.push('messaging');
    }

    for (const cap of resolved) {
        const spec = CAPABILITY_PROVIDERS[cap];
        if (!spec) {
            // Tier-gated capability (auth/ui/i18n) — wired elsewhere.
            continue;
        }

        try {
            const mod: any = await importFromHost(spec.pkg);
            const Ctor = mod[spec.export];
            if (!Ctor) {
                logger.warn?.(
                    `[CapabilityLoader] '${cap}': package '${spec.pkg}' did not export '${spec.export}'`,
                    { environmentId },
                );
                continue;
            }

            let arg: unknown;
            if (spec.configKey) {
                const v = (bundle as Record<string, unknown>)[spec.configKey];
                if (spec.configKey === 'analyticsCubes') {
                    arg = { cubes: Array.isArray(v) ? v : [] };
                } else if (v !== undefined) {
                    arg = v;
                }
            }

            await kernel.use(arg !== undefined ? new Ctor(arg) : new Ctor());
            installed.push(spec.export);

            if (spec.extras) {
                for (const ex of spec.extras) {
                    try {
                        const exMod: any = await importFromHost(ex.pkg);
                        const ExCtor = exMod[ex.export];
                        if (ExCtor) {
                            await kernel.use(new ExCtor());
                            installed.push(ex.export);
                        }
                    } catch {
                        // Optional extra — silently skip.
                    }
                }
            }

            logger.info?.(
                `[CapabilityLoader] '${cap}' installed (${spec.export}${spec.extras ? ' + ' + spec.extras.length + ' extras' : ''})`,
                { environmentId },
            );
        } catch (err: any) {
            const msg = err?.message ?? String(err);
            if (msg.includes('Cannot find module') || msg.includes('ERR_MODULE_NOT_FOUND')) {
                logger.warn?.(
                    `[CapabilityLoader] '${cap}' requested but '${spec.pkg}' not installed in host — skipped`,
                    { environmentId },
                );
            } else {
                logger.error?.(
                    `[CapabilityLoader] '${cap}' load failed: ${msg}`,
                    { environmentId },
                );
            }
        }
    }

    return installed;
}
