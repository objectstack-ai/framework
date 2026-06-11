// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0006 Phase 2 — the generic `kernelResolver` seam.
 *
 * The dispatcher gains an optional host-injected resolver that owns
 * per-request kernel selection. It coexists with the legacy `kernelManager`
 * path and TAKES PRECEDENCE over it for primary routing. The framework ships
 * no multi-tenant resolver — these tests pin the seam contract (precedence +
 * undefined → defaultKernel fallback) that cloud's resolver plugs into.
 */

import { describe, it, expect, vi } from 'vitest';
import { HttpDispatcher } from './http-dispatcher.js';
import type { KernelResolver } from './http-dispatcher.js';

/** Minimal kernel whose objectql records which instance served the request. */
function makeKernel(tag: string) {
    const objectql = {
        find: vi.fn().mockResolvedValue([]),
        getObjects: vi.fn().mockReturnValue({}),
        registry: { getObject: vi.fn().mockReturnValue(null), getRegisteredTypes: vi.fn().mockReturnValue([]) },
        __tag: tag,
    };
    const kernel: any = {
        __tag: tag,
        getService: (name: string) => (name === 'objectql' ? objectql : null),
        getServiceAsync: async (name: string) => (name === 'objectql' ? objectql : null),
        context: { getService: (name: string) => (name === 'objectql' ? objectql : null) },
    };
    return kernel;
}

describe('HttpDispatcher — ADR-0006 kernelResolver seam', () => {
    it('prefers the injected kernelResolver over kernelManager for primary routing', async () => {
        const defaultKernel = makeKernel('default');
        const envKernel = makeKernel('env');

        const resolveKernel = vi.fn(async () => envKernel);
        const kernelResolver: KernelResolver = { resolveKernel };
        const getOrCreate = vi.fn(async () => envKernel);

        const dispatcher = new HttpDispatcher(defaultKernel, undefined, {
            kernelResolver,
            kernelManager: { getOrCreate } as any,
            enforceProjectMembership: false,
        });

        await dispatcher.dispatch('GET', '/data/widget', undefined, {}, { request: {} } as any);

        // The seam was consulted exactly once, with (context, defaultKernel)…
        expect(resolveKernel).toHaveBeenCalledTimes(1);
        expect(resolveKernel.mock.calls[0][1]).toBe(defaultKernel);
        // …and it WON: the legacy kernelManager path was not used for routing.
        expect(getOrCreate).not.toHaveBeenCalled();
    });

    it('falls back to defaultKernel when the resolver returns undefined', async () => {
        const defaultKernel = makeKernel('default');
        const resolveKernel = vi.fn(async () => undefined);

        const dispatcher = new HttpDispatcher(defaultKernel, undefined, {
            kernelResolver: { resolveKernel },
            enforceProjectMembership: false,
        });

        // Should not throw — undefined routes to the single defaultKernel.
        const result = await dispatcher.dispatch('GET', '/data/widget', undefined, {}, { request: {} } as any);
        expect(resolveKernel).toHaveBeenCalledTimes(1);
        expect(result).toBeDefined();
    });

    it('uses the legacy kernelManager path when no resolver is injected (back-compat)', async () => {
        const defaultKernel = makeKernel('default');
        const envKernel = makeKernel('env');
        const getOrCreate = vi.fn(async () => envKernel);

        const dispatcher = new HttpDispatcher(defaultKernel, undefined, {
            kernelManager: { getOrCreate } as any,
            enforceProjectMembership: false,
        });

        // Force a resolved environmentId so the kernelManager branch is taken.
        await dispatcher.dispatch('GET', '/data/widget', undefined, {}, {
            request: {},
            environmentId: 'env_123',
        } as any);

        expect(getOrCreate).toHaveBeenCalledWith('env_123');
    });
});
