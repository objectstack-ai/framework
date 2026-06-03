// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Tests for the `extraPlugins` host seam on createObjectOSStack (ADR §5.2).
 * A host (e.g. ObjectStack Cloud) supplies product/policy plugins via the
 * official seam instead of mutating the returned plugins array by hand.
 */

import { describe, it, expect } from 'vitest';
import { createObjectOSStack } from './objectos-stack.js';
import type { Plugin } from '@objectstack/core';

function fakePlugin(name: string): Plugin {
    return {
        name,
        version: '0.0.0',
        async init() { /* no-op */ },
        async start() { /* no-op */ },
    } as Plugin;
}

describe('createObjectOSStack — extraPlugins seam', () => {
    it('appends host extraPlugins after the framework defaults', async () => {
        const a = fakePlugin('com.host.alpha');
        const b = fakePlugin('com.host.beta');
        const stack = await createObjectOSStack({
            controlPlaneUrl: 'http://localhost:0',
            extraPlugins: [a, b],
        });
        const names = stack.plugins.map((p: any) => p.name);
        // Both host plugins are present...
        expect(names).toContain('com.host.alpha');
        expect(names).toContain('com.host.beta');
        // ...and appended LAST, after the framework marketplace proxy.
        const proxyIdx = names.indexOf('com.objectstack.runtime.marketplace-proxy');
        expect(proxyIdx).toBeGreaterThanOrEqual(0);
        expect(names.indexOf('com.host.alpha')).toBeGreaterThan(proxyIdx);
        // ...preserving the given order.
        expect(names.indexOf('com.host.beta')).toBeGreaterThan(names.indexOf('com.host.alpha'));
    });

    it('is a no-op when extraPlugins is omitted (default stack unchanged)', async () => {
        const withSeam = await createObjectOSStack({ controlPlaneUrl: 'http://localhost:0', extraPlugins: [] });
        const without = await createObjectOSStack({ controlPlaneUrl: 'http://localhost:0' });
        expect(withSeam.plugins.length).toBe(without.plugins.length);
    });
});
