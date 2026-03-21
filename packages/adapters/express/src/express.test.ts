// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dispatcher instance
const mockDispatcher = {
  getDiscoveryInfo: vi.fn().mockReturnValue({ version: '1.0', endpoints: [] }),
  handleAuth: vi.fn().mockResolvedValue({ handled: true, response: { body: { ok: true }, status: 200 } }),
  handleGraphQL: vi.fn().mockResolvedValue({ data: {} }),
  handleStorage: vi.fn().mockResolvedValue({ handled: true, response: { body: {}, status: 200 } }),
  dispatch: vi.fn().mockResolvedValue({ handled: true, response: { body: { success: true }, status: 200 } }),
};

vi.mock('@objectstack/runtime', () => {
  return {
    HttpDispatcher: function HttpDispatcher() {
      return mockDispatcher;
    },
  };
});

import { createExpressRouter, objectStackMiddleware } from './index';

const mockKernel = { name: 'test-kernel' } as any;

function createMockRes() {
  const res: any = {
    _status: 200,
    _body: null,
    _headers: {} as Record<string, string>,
    _redirectUrl: null as string | null,
    status(code: number) { res._status = code; return res; },
    json(body: any) { res._body = body; return res; },
    send(body: any) { res._body = body; return res; },
    set(k: string, v: string) { res._headers[k] = v; return res; },
    redirect(url: string) { res._redirectUrl = url; return res; },
  };
  return res;
}

function createMockReq(overrides: any = {}) {
  return {
    method: 'GET',
    path: '/',
    url: '/',
    originalUrl: '/',
    body: {},
    query: {},
    headers: {},
    params: {},
    protocol: 'http',
    get: (key: string) => key === 'host' ? 'localhost' : undefined,
    ...overrides,
  };
}

describe('createExpressRouter', () => {
  let router: any;

  beforeEach(() => {
    vi.clearAllMocks();
    router = createExpressRouter({ kernel: mockKernel });
  });

  it('returns a router with registered routes', () => {
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
    expect(router.stack.length).toBeGreaterThan(0);
  });
});

describe('objectStackMiddleware', () => {
  it('attaches kernel to request', () => {
    const middleware = objectStackMiddleware(mockKernel);
    const req: any = {};
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(req.objectStack).toBe(mockKernel);
    expect(next).toHaveBeenCalled();
  });
});
