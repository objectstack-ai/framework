// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { HttpDispatcher } from './http-dispatcher.js';

/**
 * These tests drive `handleMcp` directly to verify the gate + auth + bridge
 * wiring without standing up a full kernel. The MCP transport itself is tested
 * in @objectstack/mcp; here we assert:
 *  - opt-in gate (OS_MCP_SERVER_ENABLED)
 *  - fail-closed auth (anonymous → 401)
 *  - the injected bridge runs through callData bound to the request's
 *    ExecutionContext (RLS/permissions), proving principal binding.
 */

function makeContext(overrides: any = {}) {
  return {
    request: new Request('http://localhost/api/v1/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: '{}',
    }),
    response: {},
    environmentId: undefined,
    executionContext: { userId: 'u1', isSystem: false, roles: [], permissions: [] },
    ...overrides,
  };
}

/** A fake kernel exposing only the services handleMcp / callData need. */
function makeKernel(opts: { withMcp?: boolean; recordedContexts?: any[] } = {}) {
  const recorded = opts.recordedContexts ?? [];
  const ql = {
    insert: async (_o: string, data: any, o: any) => {
      recorded.push(o?.context);
      return { id: 'new1', ...data };
    },
    find: async () => [],
    update: async () => ({}),
    delete: async () => ({}),
  };
  const metadata = {
    listObjects: async () => [{ name: 'task', fields: { title: {} } }],
    getObject: async (n: string) => (n === 'task' ? { name: 'task', fields: {} } : null),
  };
  // The fake MCP service exercises the bridge so we can assert principal binding.
  const mcpService: any = {
    lastOpts: undefined,
    lastReq: undefined,
    handleHttpRequest: async (_req: Request, o: any) => {
      mcpService.lastOpts = o;
      mcpService.lastReq = _req;
      const created = await o.bridge.create('task', { title: 'x' });
      return new Response(JSON.stringify({ ok: true, created }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  };
  const services: Record<string, any> = { metadata, objectql: ql };
  if (opts.withMcp) services.mcp = mcpService;
  const kernel: any = {
    getService: (n: string) => services[n],
    getServiceAsync: async (n: string) => services[n],
  };
  return { kernel, mcpService, recorded };
}

describe('HttpDispatcher.handleMcp', () => {
  const prev = process.env.OS_MCP_SERVER_ENABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.OS_MCP_SERVER_ENABLED;
    else process.env.OS_MCP_SERVER_ENABLED = prev;
  });

  it('returns 404 when MCP is not enabled (opt-in gate)', async () => {
    delete process.env.OS_MCP_SERVER_ENABLED;
    const { kernel } = makeKernel({ withMcp: true });
    const d = new HttpDispatcher(kernel, undefined, { enforceProjectMembership: false });
    const res = await d.handleMcp({}, makeContext());
    expect(res.response.status).toBe(404);
  });

  describe('when enabled', () => {
    beforeEach(() => {
      process.env.OS_MCP_SERVER_ENABLED = 'true';
    });

    it('returns 501 when no MCP service is registered', async () => {
      const { kernel } = makeKernel({ withMcp: false });
      const d = new HttpDispatcher(kernel, undefined, { enforceProjectMembership: false });
      const res = await d.handleMcp({}, makeContext());
      expect(res.response.status).toBe(501);
    });

    it('normalises a node/Hono-style req into a Web Request for the transport', async () => {
      // Regression: production hands the dispatcher a node/Hono req (plain
      // headers object, path-only url) — NOT a Web Request. handleMcp must
      // reconstruct one so the transport's headers.get()/new URL(url) work.
      const { kernel, mcpService } = makeKernel({ withMcp: true });
      const d = new HttpDispatcher(kernel, undefined, { enforceProjectMembership: false });
      const nodeReq = {
        method: 'POST',
        url: '/api/v1/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          host: 'env.objectos.app',
          'x-api-key': 'osk_demo',
        },
      };
      const res = await d.handleMcp({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, makeContext({ request: nodeReq }));
      expect(res.response.status).toBe(200);
      const req = mcpService.lastReq as Request;
      expect(typeof req.headers.get).toBe('function');
      expect(req.method).toBe('POST');
      expect(req.url).toBe('https://env.objectos.app/api/v1/mcp');
      expect(req.headers.get('x-api-key')).toBe('osk_demo');
      expect(req.headers.get('accept')).toContain('text/event-stream');
    });

    it('normalises a GET node req without a body', async () => {
      const { kernel, mcpService } = makeKernel({ withMcp: true });
      const d = new HttpDispatcher(kernel, undefined, { enforceProjectMembership: false });
      const nodeReq = { method: 'GET', url: '/api/v1/mcp', headers: { host: 'env.objectos.app', accept: 'text/event-stream' } };
      await d.handleMcp(undefined, makeContext({ request: nodeReq }));
      const req = mcpService.lastReq as Request;
      expect(req.method).toBe('GET');
      expect(req.url).toBe('https://env.objectos.app/api/v1/mcp');
    });

    it('returns 401 for an anonymous request (fail-closed auth)', async () => {
      const { kernel } = makeKernel({ withMcp: true });
      const d = new HttpDispatcher(kernel, undefined, { enforceProjectMembership: false });
      const res = await d.handleMcp({}, makeContext({ executionContext: undefined }));
      expect(res.response.status).toBe(401);
    });

    it('delegates to the MCP runtime with a bridge + parsedBody when authed', async () => {
      const { kernel, mcpService } = makeKernel({ withMcp: true });
      const d = new HttpDispatcher(kernel, undefined, { enforceProjectMembership: false });
      const body = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
      const res = await d.handleMcp(body, makeContext());
      expect(res.response.status).toBe(200);
      expect(res.response.body.ok).toBe(true);
      expect(mcpService.lastOpts.parsedBody).toEqual(body);
      expect(typeof mcpService.lastOpts.bridge.query).toBe('function');
    });

    it('binds the bridge to the request ExecutionContext (RLS/permissions)', async () => {
      const recorded: any[] = [];
      const { kernel } = makeKernel({ withMcp: true, recordedContexts: recorded });
      const d = new HttpDispatcher(kernel, undefined, { enforceProjectMembership: false });
      await d.handleMcp({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, makeContext());
      // The fake MCP service called bridge.create → callData → ql.insert with
      // { context }. That context MUST be the caller's principal, not system.
      expect(recorded.length).toBe(1);
      expect(recorded[0]?.userId).toBe('u1');
      expect(recorded[0]?.isSystem).toBe(false);
    });
  });
});
