// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';

import { createDispatcherPlugin } from './dispatcher-plugin.js';

/**
 * Regression: the dispatcher mounts routes EXPLICITLY on the HTTP server (there
 * is no catch-all). A dispatch() branch with no matching `server.<verb>()`
 * registration is unreachable over HTTP and 404s before reaching the handler —
 * which is exactly how /mcp and /keys shipped broken (unit tests called the
 * handlers directly, hiding it). This test asserts the routes are registered.
 */

function makeFakeServer() {
  const routes: string[] = [];
  const handlers: Record<string, (req: any, res: any) => any> = {};
  const rec = (verb: string) => (path: string, handler: any) => {
    routes.push(`${verb} ${path}`);
    handlers[`${verb} ${path}`] = handler;
  };
  return {
    routes,
    handlers,
    server: {
      get: rec('GET'),
      post: rec('POST'),
      put: rec('PUT'),
      delete: rec('DELETE'),
      patch: rec('PATCH'),
    },
  };
}

function makeCtx(fakeServer: any) {
  const kernel = {
    getService: () => undefined,
    getServiceAsync: async () => undefined,
  };
  return {
    getKernel: () => kernel,
    getService: (name: string) => (name === 'http.server' ? fakeServer : undefined),
    environmentId: undefined,
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    hook: () => {},
    on: () => {},
  } as any;
}

describe('createDispatcherPlugin — HTTP route registration', () => {
  it('mounts /mcp (GET/POST/DELETE) and /keys (POST) so they reach dispatch()', async () => {
    const { server, routes } = makeFakeServer();
    const plugin = createDispatcherPlugin({ prefix: '/api/v1', securityHeaders: false });
    await plugin.start?.(makeCtx(server));

    expect(routes).toContain('POST /api/v1/mcp');
    expect(routes).toContain('GET /api/v1/mcp');
    expect(routes).toContain('DELETE /api/v1/mcp');
    expect(routes).toContain('POST /api/v1/keys');
  });

  it('also mounts a known existing route (sanity that start() ran)', async () => {
    const { server, routes } = makeFakeServer();
    const plugin = createDispatcherPlugin({ prefix: '/api/v1', securityHeaders: false });
    await plugin.start?.(makeCtx(server));

    expect(routes).toContain('POST /api/v1/analytics/query');
  });

  it('honours a custom prefix', async () => {
    const { server, routes } = makeFakeServer();
    const plugin = createDispatcherPlugin({ prefix: '/v2', securityHeaders: false });
    await plugin.start?.(makeCtx(server));

    expect(routes).toContain('POST /v2/mcp');
    expect(routes).toContain('POST /v2/keys');
  });

  // cloud#152: discovery reflects mutable runtime config (e.g. routes.mcp toggles
  // with OS_MCP_SERVER_ENABLED). It must be served Cache-Control: no-store so an
  // edge/CDN never serves a stale payload after the config changes.
  it('serves both discovery routes with Cache-Control: no-store', async () => {
    const { server, handlers } = makeFakeServer();
    const plugin = createDispatcherPlugin({ prefix: '/api/v1', securityHeaders: false });
    await plugin.start?.(makeCtx(server));

    for (const route of ['GET /.well-known/objectstack', 'GET /api/v1/discovery']) {
      const handler = handlers[route];
      expect(handler, `${route} should be registered`).toBeTypeOf('function');
      const headers: Record<string, string> = {};
      const res: any = {
        header: (k: string, v: string) => { headers[k] = v; },
        json: () => {},
      };
      await handler({}, res);
      expect(headers['Cache-Control'], `${route} Cache-Control`).toBe('no-store');
    }
  });
});
