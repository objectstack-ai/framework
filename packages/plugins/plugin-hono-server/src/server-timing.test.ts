// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HonoServerPlugin, isDebugTimingRequested } from './hono-plugin';
import { countServerTiming, allowPerfDisclosure } from '@objectstack/observability';
import type { PluginContext } from '@objectstack/core';

/**
 * Integration tests for the opt-in `Server-Timing` (perf-tuning) middleware.
 * Uses the real Hono adapter (no mock) and drives requests through the raw
 * Hono app via `app.request()`.
 */

function fakeCtx(): PluginContext {
    const services = new Map<string, unknown>();
    return {
        logger: { debug() {}, info() {}, warn() {}, error() {} },
        registerService: (name: string, svc: unknown) => services.set(name, svc),
        getService: (name: string) => services.get(name),
    } as unknown as PluginContext;
}

async function setup(opts: { serverTiming?: boolean } = {}) {
    const plugin = new HonoServerPlugin({ ...opts, cors: false });
    await (plugin as any).init(fakeCtx());
    const server = (plugin as any).server;
    server.get('/ping', (_req: any, res: any) => res.json({ ok: true }));
    // Simulates the request path proving an admin/service identity mid-dispatch:
    // the dispatcher calls `allowPerfDisclosure()` after resolving the principal.
    server.get('/admin', (_req: any, res: any) => {
        allowPerfDisclosure();
        return res.json({ ok: true });
    });
    const app = server.getRawApp();
    return { plugin, server, app };
}

describe('Server-Timing (perf-tuning) middleware', () => {
    const prevServer = process.env.OS_SERVER_TIMING;
    const prevPerf = process.env.OS_PERF_TIMING;
    beforeEach(() => {
        delete process.env.OS_SERVER_TIMING;
        delete process.env.OS_PERF_TIMING;
    });
    afterEach(() => {
        if (prevServer === undefined) delete process.env.OS_SERVER_TIMING;
        else process.env.OS_SERVER_TIMING = prevServer;
        if (prevPerf === undefined) delete process.env.OS_PERF_TIMING;
        else process.env.OS_PERF_TIMING = prevPerf;
    });

    it('is OFF by default — no Server-Timing header', async () => {
        const { app } = await setup();
        const res = await app.request('/ping');
        expect(res.status).toBe(200);
        expect(res.headers.get('Server-Timing')).toBeNull();
    });

    it('emits Server-Timing with total + sub-phases when serverTiming: true', async () => {
        const { app } = await setup({ serverTiming: true });
        const res = await app.request('/ping');
        expect(res.status).toBe(200);
        const header = res.headers.get('Server-Timing');
        expect(header).toBeTruthy();
        // total is always present; the adapter contributes parse + handler,
        // and serialize (the /ping handler calls res.json).
        expect(header).toMatch(/(^|, )total;dur=[\d.]+/);
        expect(header).toContain('handler;dur=');
        expect(header).toContain('serialize;dur=');
        expect(await res.json()).toEqual({ ok: true });
    });

    it('folds request-scoped aggregate spans (e.g. db query count) into the header', async () => {
        const { server, app } = await setup({ serverTiming: true });
        // Simulate the SQL driver recording two per-query timings for this request.
        server.get('/agg', (_req: any, res: any) => {
            countServerTiming('db', 4, 'queries');
            countServerTiming('db', 6, 'queries');
            return res.json({ ok: true });
        });
        const res = await app.request('/agg');
        const header = res.headers.get('Server-Timing');
        expect(header).toBeTruthy();
        // One aggregate member carrying summed duration + event count — not two.
        expect(header).toContain('db;dur=10;desc="2 queries"');
    });

    it('is enabled via OS_SERVER_TIMING=true when the option is unset', async () => {
        process.env.OS_SERVER_TIMING = 'true';
        const { app } = await setup();
        const res = await app.request('/ping');
        expect(res.headers.get('Server-Timing')).toMatch(/total;dur=/);
    });

    it('explicit serverTiming: false overrides OS_SERVER_TIMING=true', async () => {
        process.env.OS_SERVER_TIMING = 'true';
        const { app } = await setup({ serverTiming: false });
        const res = await app.request('/ping');
        expect(res.headers.get('Server-Timing')).toBeNull();
    });

    it('is enabled globally via OS_PERF_TIMING=1 (issue #2408 env alias)', async () => {
        process.env.OS_PERF_TIMING = '1';
        const { app } = await setup();
        const res = await app.request('/ping');
        expect(res.headers.get('Server-Timing')).toMatch(/total;dur=/);
    });

    describe('per-request gating via X-OS-Debug-Timing', () => {
        it('withholds the header for the debug header ALONE (unverified caller)', async () => {
            // Global mode off; the caller asks for timing but never proves an
            // admin/service identity → no disclosure.
            const { app } = await setup();
            const res = await app.request('/ping', { headers: { 'X-OS-Debug-Timing': '1' } });
            expect(res.status).toBe(200);
            expect(res.headers.get('Server-Timing')).toBeNull();
        });

        it('emits the header once an admin/service identity is proven', async () => {
            const { app } = await setup();
            const res = await app.request('/admin', { headers: { 'X-OS-Debug-Timing': '1' } });
            expect(res.status).toBe(200);
            const header = res.headers.get('Server-Timing');
            expect(header).toBeTruthy();
            expect(header).toMatch(/(^|, )total;dur=[\d.]+/);
            expect(header).toContain('serialize;dur=');
        });

        it('does NOT emit for an admin when no debug header is sent (opt-in only)', async () => {
            // Global mode off + no debug header → the collector never opens, even
            // though the handler would grant disclosure.
            const { app } = await setup();
            const res = await app.request('/admin');
            expect(res.headers.get('Server-Timing')).toBeNull();
        });

        it('stays hard-disabled under serverTiming: false even for an admin', async () => {
            const { app } = await setup({ serverTiming: false });
            const res = await app.request('/admin', { headers: { 'X-OS-Debug-Timing': '1' } });
            expect(res.headers.get('Server-Timing')).toBeNull();
        });

        it('global mode discloses to everyone regardless of the debug header', async () => {
            const { app } = await setup({ serverTiming: true });
            const res = await app.request('/ping'); // no debug header, non-admin
            expect(res.headers.get('Server-Timing')).toMatch(/total;dur=/);
        });
    });
});

describe('isDebugTimingRequested', () => {
    it('accepts common truthy spellings', () => {
        for (const v of ['1', 'true', 'TRUE', 'yes', 'on', ' On ']) {
            expect(isDebugTimingRequested(v)).toBe(true);
        }
    });
    it('rejects falsy / absent / other values', () => {
        for (const v of [undefined, null, '', '0', 'false', 'no', 'off', 'maybe']) {
            expect(isDebugTimingRequested(v)).toBe(false);
        }
    });
});
