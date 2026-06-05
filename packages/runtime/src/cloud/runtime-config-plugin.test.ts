// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Tests for RuntimeConfigPlugin's per-request capability gating.
 *
 * The tenant runtime serves `GET /api/v1/runtime/config`. `features.aiStudio`
 * must follow the resolved environment's billing plan: free → off, paid → on,
 * and the static default must survive when the plan can't be resolved.
 */

import { describe, it, expect } from 'vitest';
import { RuntimeConfigPlugin } from './runtime-config-plugin.js';

/** Drive the plugin's start() and capture the mounted `/runtime/config` handler. */
async function mountAndGetHandler(opts: {
    pluginConfig?: ConstructorParameters<typeof RuntimeConfigPlugin>[0];
    resolveByHostname?: (host: string) => Promise<any>;
}): Promise<(c: any) => Promise<any>> {
    let handler: ((c: any) => Promise<any>) | undefined;
    const rawApp = {
        get(path: string, h: (c: any) => Promise<any>) {
            if (path === '/api/v1/runtime/config') handler = h;
        },
    };
    const services: Record<string, any> = {
        'http-server': { getRawApp: () => rawApp },
    };
    if (opts.resolveByHostname) {
        services['env-registry'] = { resolveByHostname: opts.resolveByHostname };
    }
    const ctx: any = {
        logger: { info() {}, warn() {} },
        getService: (name: string) => {
            const s = services[name];
            if (!s) throw new Error(`no service ${name}`);
            return s;
        },
        hooks: [] as Array<() => Promise<void>>,
        hook(_event: string, cb: () => Promise<void>) { this.hooks.push(cb); },
    };
    const plugin = new RuntimeConfigPlugin(opts.pluginConfig ?? {});
    await plugin.start(ctx);
    for (const cb of ctx.hooks) await cb(); // fire kernel:ready
    if (!handler) throw new Error('handler not mounted');
    return handler;
}

function fakeCtx(host: string) {
    let captured: any;
    return {
        c: { req: { header: (n: string) => (n.toLowerCase() === 'host' ? host : undefined) }, json: (b: any) => { captured = b; return b; } },
        get payload() { return captured; },
    };
}

describe('RuntimeConfigPlugin — aiStudio plan gating', () => {
    it('disables aiStudio for a free-plan environment', async () => {
        const handler = await mountAndGetHandler({
            resolveByHostname: async () => ({ environmentId: 'env1', organizationId: 'org1', plan: 'free' }),
        });
        const { c } = fakeCtx('acme.objectos.ai');
        const body = await handler(c);
        expect(body.features.aiStudio).toBe(false);
        expect(body.defaultEnvironmentId).toBe('env1');
    });

    it('enables aiStudio for a paid-plan environment', async () => {
        const handler = await mountAndGetHandler({
            resolveByHostname: async () => ({ environmentId: 'env2', plan: 'pro' }),
        });
        const { c } = fakeCtx('acme.objectos.ai');
        const body = await handler(c);
        expect(body.features.aiStudio).toBe(true);
    });

    it('keeps the static default when the plan is absent', async () => {
        const handler = await mountAndGetHandler({
            resolveByHostname: async () => ({ environmentId: 'env3' }), // no plan
        });
        const { c } = fakeCtx('acme.objectos.ai');
        const body = await handler(c);
        expect(body.features.aiStudio).toBe(true); // default is true
    });

    it('honours an explicit aiStudio=false default when plan is absent', async () => {
        const handler = await mountAndGetHandler({
            pluginConfig: { aiStudio: false },
            resolveByHostname: async () => ({ environmentId: 'env4' }),
        });
        const { c } = fakeCtx('acme.objectos.ai');
        const body = await handler(c);
        expect(body.features.aiStudio).toBe(false);
    });

    it('a free plan overrides even an aiStudio=true default', async () => {
        const handler = await mountAndGetHandler({
            pluginConfig: { aiStudio: true },
            resolveByHostname: async () => ({ environmentId: 'env5', plan: 'FREE' }),
        });
        const { c } = fakeCtx('acme.objectos.ai');
        const body = await handler(c);
        expect(body.features.aiStudio).toBe(false);
    });
});
