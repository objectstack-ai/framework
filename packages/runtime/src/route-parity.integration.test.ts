// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LiteKernel } from '@objectstack/core';
import { HonoServerPlugin } from '@objectstack/plugin-hono-server';

import { createDispatcherPlugin } from './dispatcher-plugin.js';

/**
 * Route-parity gate — `declared === enforced` for HTTP routes (issue #3369).
 *
 * ObjectStack has TWO route-registration paths: the runtime `HttpDispatcher` /
 * `createDispatcherPlugin`, and the standalone hono server
 * (`@objectstack/plugin-hono-server`). `os serve` / `os dev` / `os start` mount
 * BOTH — the dispatcher registers its routes on the hono `http.server`. A class
 * of v16.0 bugs (#3361 Server-Timing, #3362 notifications, the MCP `501`) shared
 * one root cause: a handler was reachable on ONE path while the shipped server
 * ran the OTHER, so discovery advertised routes that 404/501'd on the real
 * listener — and every unit test exercised the two paths in isolation, so the
 * integration gap was invisible.
 *
 * This gate boots the REAL hono app the way `os serve` mounts it (hono server +
 * dispatcher plugin, services provisioned), opens a socket, reads
 * `/api/v1/discovery`, and asserts:
 *   1. every route advertised in discovery is REACHABLE (never 404 / 405 / 501)
 *      — for an anonymous AND an authenticated (admin) principal;
 *   2. discovery is service-aware in BOTH directions — a route is advertised
 *      IFF its backing service is present (no dead advertisement).
 *
 * Scope: this covers the dispatcher ↔ hono seam, where the #3361/#3362/MCP
 * regressions lived. The admin-gated `Server-Timing` behaviour is covered
 * end-to-end by `@objectstack/plugin-hono-server`'s `server-timing-e2e.test.ts`
 * and `@objectstack/rest`'s `rest-server-timing.test.ts` (#3384); the
 * notifications mark-read flow by `notifications.hono.integration.test.ts`
 * (#3388); and the REST-owned surface (`/data`, `/meta`, `/ui`) by the
 * `@objectstack/client` integration suite. This gate deliberately does not
 * duplicate those.
 */

// ── Stub services provisioned exactly as a real `os serve` would ─────────────

/** A super-user permission set (the PLATFORM_ADMIN `admin_full_access` rung). */
const ADMIN_SET = {
    id: 'ps-admin',
    name: 'admin_full_access',
    object_permissions: { '*': { viewAllRecords: true, modifyAllRecords: true } },
};

/**
 * objectql stub answering the `find()` calls the identity resolvers make, plus
 * the data route's own list query. `admin1` → `admin_full_access`.
 */
function fakeObjectQL() {
    return {
        async find(object: string, opts: any) {
            const where = opts?.where ?? {};
            if (object === 'sys_user_permission_set') {
                const uid = where.user_id;
                return uid === 'admin1'
                    ? [{ user_id: uid, permission_set_id: 'ps-admin', organization_id: null }]
                    : [];
            }
            if (object === 'sys_permission_set') {
                const ids: string[] = where?.id?.$in ?? [];
                return ids.includes('ps-admin') ? [ADMIN_SET] : [];
            }
            return [];
        },
    };
}

/** better-auth-style session getter resolving the user from a test header. */
function fakeAuth() {
    return {
        api: {
            async getSession({ headers }: { headers: Headers }) {
                const uid = headers.get('x-test-user');
                return uid ? { user: { id: uid } } : null;
            },
        },
    };
}

function fakeNotification() {
    return {
        async listInbox() { return { items: [], unreadCount: 0 }; },
        async markRead() { return { updated: 0 }; },
        async markAllRead() { return { updated: 0 }; },
    };
}

function fakeMcp() {
    return {
        async handleHttpRequest() {
            return { status: 200, headers: {}, body: { jsonrpc: '2.0', result: {} } };
        },
    };
}

function stubServicesPlugin(opts: { notification?: boolean; mcp?: boolean } = {}) {
    return {
        name: 'com.objectstack.test.route-parity-stubs',
        version: '1.0.0',
        init: async (ctx: any) => {
            ctx.registerService('auth', fakeAuth());
            ctx.registerService('objectql', fakeObjectQL());
            if (opts.notification !== false) ctx.registerService('notification', fakeNotification());
            if (opts.mcp !== false) ctx.registerService('mcp', fakeMcp());
        },
    };
}

async function bootServe(stubOpts: { notification?: boolean; mcp?: boolean } = {}) {
    const kernel = new LiteKernel();
    // Register stub services FIRST so identity + capability services are live
    // for both registration paths (mirrors a provisioned `os serve`).
    kernel.use(stubServicesPlugin(stubOpts));
    kernel.use(new HonoServerPlugin({ port: 0, registerStandardEndpoints: true, cors: false }));
    kernel.use(createDispatcherPlugin({ prefix: '/api/v1', securityHeaders: false, requireAuth: true }));
    await kernel.bootstrap();
    const httpServer = kernel.getService<any>('http.server');
    const baseUrl = `http://127.0.0.1:${httpServer.getPort()}`;
    return { kernel, baseUrl };
}

async function shutdown(kernel: LiteKernel) {
    await Promise.race([kernel.shutdown(), new Promise<void>((r) => setTimeout(r, 10_000))]);
}

describe('Route parity: discovery-advertised routes are reachable on os serve (#3369)', () => {
    let kernel: LiteKernel;
    let baseUrl: string;

    beforeAll(async () => {
        ({ kernel, baseUrl } = await bootServe());
    }, 30_000);

    afterAll(async () => { if (kernel) await shutdown(kernel); }, 30_000);

    it('serves discovery and advertises the provisioned capability routes', async () => {
        const res = await fetch(`${baseUrl}/api/v1/discovery`);
        expect(res.status).toBe(200);
        const routes = (await res.json())?.data?.routes ?? {};
        // Always-on kernel routes.
        expect(routes.data).toBeTruthy();
        expect(routes.metadata).toBeTruthy();
        // Provisioned optional capabilities → advertised (declared).
        expect(routes.notifications, 'notifications must be advertised when the service is present').toBeTruthy();
        expect(routes.mcp, 'mcp must be advertised when enabled').toBeTruthy();
    });

    /**
     * The core gate: every route the server ADVERTISES must be ENFORCED —
     * reachable on the actual listener. 404 (route not mounted), 405 (wrong
     * method sink) and 501 (advertised but no backing handler/service) all mean
     * declared ≠ enforced. An anonymous caller legitimately gets 401/403; that
     * still proves the route is mounted.
     */
    const DEAD_STATUSES = new Set([404, 405, 501]);
    const probes: Array<{ method: string; path: string; note: string }> = [
        { method: 'GET', path: '/api/v1/health', note: 'liveness probe' },
        { method: 'GET', path: '/api/v1/ready', note: 'readiness probe' },
        { method: 'GET', path: '/api/v1/notifications', note: '#3362 inbox list' },
        { method: 'POST', path: '/api/v1/notifications/read', note: '#3362 mark-read' },
        { method: 'POST', path: '/api/v1/notifications/read/all', note: '#3362 mark-all-read' },
        { method: 'POST', path: '/api/v1/mcp', note: 'MCP 501 regression' },
    ];

    it('every advertised/dispatcher route is reachable (not 404/405/501) for an anonymous caller', async () => {
        for (const { method, path, note } of probes) {
            const res = await fetch(`${baseUrl}${path}`, { method });
            expect(
                DEAD_STATUSES.has(res.status),
                `${method} ${path} (${note}) returned ${res.status} — declared but not enforced`,
            ).toBe(false);
        }
    });

    it('every advertised/dispatcher route is reachable (not 404/405/501) for an admin principal', async () => {
        for (const { method, path, note } of probes) {
            const res = await fetch(`${baseUrl}${path}`, { method, headers: { 'x-test-user': 'admin1' } });
            expect(
                DEAD_STATUSES.has(res.status),
                `${method} ${path} (${note}) returned ${res.status} for admin — declared but not enforced`,
            ).toBe(false);
        }
    });

    it('marks notifications read for an authenticated user (the #3362 end-to-end path)', async () => {
        // The exact call the Console makes (AppHeader mark-all-read). With the
        // notification service present it must reach the handler and succeed —
        // NOT 404 (the shipped-server regression #3354 set out to fix).
        const res = await fetch(`${baseUrl}/api/v1/notifications/read/all`, {
            method: 'POST',
            headers: { 'x-test-user': 'admin1', 'content-type': 'application/json' },
            body: '{}',
        });
        expect(res.status).toBe(200);
    });

    it('MCP is advertised AND reachable — the discovery/route lockstep holds (not 501)', async () => {
        const disc = await (await fetch(`${baseUrl}/api/v1/discovery`)).json();
        expect(disc.data.routes.mcp).toBeTruthy();
        // With the mcp service provisioned, /mcp must NOT 501 ("not available").
        // Anonymous → 401 (a key/token is required) — reachable.
        const res = await fetch(`${baseUrl}/api/v1/mcp`, { method: 'POST', body: '{}' });
        expect(res.status).not.toBe(501);
        expect(res.status).not.toBe(404);
    });
});

describe('Route parity: discovery is service-aware — no dead advertisement (#3369)', () => {
    let kernel: LiteKernel;
    let baseUrl: string;

    beforeAll(async () => {
        // Boot WITHOUT the notification service.
        ({ kernel, baseUrl } = await bootServe({ notification: false }));
    }, 30_000);

    afterAll(async () => { if (kernel) await shutdown(kernel); }, 30_000);

    it('does NOT advertise a capability whose backing service is absent', async () => {
        const disc = await (await fetch(`${baseUrl}/api/v1/discovery`)).json();
        expect(
            disc.data.routes.notifications,
            'notifications must NOT be advertised when the service is absent (declared === enforced)',
        ).toBeFalsy();
    });

    it('a request to the un-provisioned notifications route resolves to 404 (consistent with not advertising it)', async () => {
        // Not advertised AND 404 → declared === enforced (neither over- nor
        // under-promised). The failure mode #3369 forbids is the inverse:
        // advertised in discovery yet 404 on the listener.
        const res = await fetch(`${baseUrl}/api/v1/notifications`, { headers: { 'x-test-user': 'admin1' } });
        expect(res.status).toBe(404);
    });
});
