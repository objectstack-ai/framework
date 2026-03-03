// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dispatcher instance
const mockDispatcher = {
  getDiscoveryInfo: vi.fn().mockReturnValue({ version: '1.0', endpoints: [] }),
  handleAuth: vi.fn().mockResolvedValue({ handled: true, response: { body: { ok: true }, status: 200 } }),
  handleGraphQL: vi.fn().mockResolvedValue({ data: {} }),
  handleMetadata: vi.fn().mockResolvedValue({ handled: true, response: { body: { objects: [] }, status: 200 } }),
  handleData: vi.fn().mockResolvedValue({ handled: true, response: { body: { records: [] }, status: 200 } }),
  handleStorage: vi.fn().mockResolvedValue({ handled: true, response: { body: {}, status: 200 } }),
};

vi.mock('@objectstack/runtime', () => {
  return {
    HttpDispatcher: function HttpDispatcher() {
      return mockDispatcher;
    },
  };
});

vi.mock('next/server', () => {
  class MockNextRequest {
    url: string;
    method: string;
    private _body: any;

    constructor(url: string, init?: any) {
      this.url = url;
      this.method = init?.method || 'GET';
      this._body = init?.body;
    }

    async json() {
      return this._body ? JSON.parse(this._body) : {};
    }

    async formData() {
      const map = new Map();
      map.set('file', { name: 'test.txt', type: 'text/plain' });
      // Return a FormData-like object with get()
      return { get: (key: string) => map.get(key) };
    }
  }

  class MockNextResponse {
    body: any;
    status: number;
    headers: Record<string, string>;

    constructor(body?: any, init?: any) {
      this.body = body;
      this.status = init?.status || 200;
      this.headers = init?.headers || {};
    }

    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }

    static json(body: any, init?: any) {
      const res = new MockNextResponse(body, init);
      return res;
    }

    static redirect(url: string | URL) {
      const res = new MockNextResponse(null, { status: 307 });
      (res as any).redirectUrl = typeof url === 'string' ? url : url.toString();
      return res;
    }
  }

  return { NextRequest: MockNextRequest, NextResponse: MockNextResponse };
});

import { NextRequest } from 'next/server';
import { createRouteHandler, createDiscoveryHandler } from './index';

const mockKernel = { name: 'test-kernel' } as any;

function makeReq(url: string, method = 'GET', body?: any) {
  const init: any = { method };
  if (body) init.body = JSON.stringify(body);
  return new (NextRequest as any)(url, init);
}

describe('createRouteHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Discovery Endpoint', () => {
    it('GET with empty segments returns discovery info', async () => {
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api');
      const res = await handler(req, { params: { objectstack: [] } });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { version: '1.0', endpoints: [] } });
      expect(mockDispatcher.getDiscoveryInfo).toHaveBeenCalledWith('/api');
    });

    it('uses custom prefix for discovery', async () => {
      const handler = createRouteHandler({ kernel: mockKernel, prefix: '/v2' });
      const req = makeReq('http://localhost/v2');
      const res = await handler(req, { params: { objectstack: [] } });
      expect(res.status).toBe(200);
      expect(mockDispatcher.getDiscoveryInfo).toHaveBeenCalledWith('/v2');
    });
  });

  describe('Auth Endpoint', () => {
    it('POST auth/login calls handleAuth', async () => {
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/auth/login', 'POST', { email: 'a@b.com' });
      const res = await handler(req, { params: { objectstack: ['auth', 'login'] } });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockDispatcher.handleAuth).toHaveBeenCalledWith(
        'login',
        'POST',
        expect.any(Object),
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('GET auth/callback calls handleAuth with empty body', async () => {
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/auth/callback', 'GET');
      const res = await handler(req, { params: { objectstack: ['auth', 'callback'] } });
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleAuth).toHaveBeenCalledWith(
        'callback',
        'GET',
        {},
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('returns error on handleAuth exception', async () => {
      mockDispatcher.handleAuth.mockRejectedValueOnce(
        Object.assign(new Error('Unauthorized'), { statusCode: 401 }),
      );
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/auth/login', 'POST');
      const res = await handler(req, { params: { objectstack: ['auth', 'login'] } });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Unauthorized');
    });
  });

  describe('Auth via AuthPlugin service', () => {
    it('uses kernel.getService("auth") when available', async () => {
      const mockHandleRequest = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ user: { id: '1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const kernelWithAuth = {
        ...mockKernel,
        getService: vi.fn().mockReturnValue({ handleRequest: mockHandleRequest }),
      };
      const handler = createRouteHandler({ kernel: kernelWithAuth });
      const req = makeReq('http://localhost/api/auth/sign-in/email', 'POST', { email: 'a@b.com', password: 'pass' });
      const res = await handler(req, { params: { objectstack: ['auth', 'sign-in', 'email'] } });
      expect(res.status).toBe(200);
      expect(kernelWithAuth.getService).toHaveBeenCalledWith('auth');
      expect(mockHandleRequest).toHaveBeenCalled();
      expect(mockDispatcher.handleAuth).not.toHaveBeenCalled();
    });

    it('falls back to dispatcher.handleAuth when auth service is not available', async () => {
      const kernelWithoutAuth = {
        ...mockKernel,
        getService: vi.fn().mockReturnValue(null),
      };
      const handler = createRouteHandler({ kernel: kernelWithoutAuth });
      const req = makeReq('http://localhost/api/auth/login', 'POST', { email: 'a@b.com' });
      const res = await handler(req, { params: { objectstack: ['auth', 'login'] } });
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleAuth).toHaveBeenCalled();
    });

    it('forwards GET requests to auth service', async () => {
      const mockHandleRequest = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ session: { token: 'abc' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const kernelWithAuth = {
        ...mockKernel,
        getService: vi.fn().mockReturnValue({ handleRequest: mockHandleRequest }),
      };
      const handler = createRouteHandler({ kernel: kernelWithAuth });
      const req = makeReq('http://localhost/api/auth/get-session', 'GET');
      const res = await handler(req, { params: { objectstack: ['auth', 'get-session'] } });
      expect(res.status).toBe(200);
      expect(mockHandleRequest).toHaveBeenCalled();
    });

    it('returns error when auth service throws', async () => {
      const mockHandleRequest = vi.fn().mockRejectedValue(new Error('Auth failed'));
      const kernelWithAuth = {
        ...mockKernel,
        getService: vi.fn().mockReturnValue({ handleRequest: mockHandleRequest }),
      };
      const handler = createRouteHandler({ kernel: kernelWithAuth });
      const req = makeReq('http://localhost/api/auth/sign-in/email', 'POST', { email: 'a@b.com' });
      const res = await handler(req, { params: { objectstack: ['auth', 'sign-in', 'email'] } });
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('uses kernel.getServiceAsync("auth") when available (async factory)', async () => {
      const mockHandleRequest = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ user: { id: '2' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const kernelWithAsyncAuth = {
        ...mockKernel,
        getServiceAsync: vi.fn().mockResolvedValue({ handleRequest: mockHandleRequest }),
      };
      const handler = createRouteHandler({ kernel: kernelWithAsyncAuth });
      const req = makeReq('http://localhost/api/auth/sign-in/email', 'POST', { email: 'a@b.com', password: 'pass' });
      const res = await handler(req, { params: { objectstack: ['auth', 'sign-in', 'email'] } });
      expect(res.status).toBe(200);
      expect(kernelWithAsyncAuth.getServiceAsync).toHaveBeenCalledWith('auth');
      expect(mockHandleRequest).toHaveBeenCalled();
    });

    it('falls back to dispatcher when getServiceAsync throws', async () => {
      const kernelWithFailingAsync = {
        ...mockKernel,
        getServiceAsync: vi.fn().mockRejectedValue(new Error("Service 'auth' not found")),
      };
      const handler = createRouteHandler({ kernel: kernelWithFailingAsync });
      const req = makeReq('http://localhost/api/auth/login', 'POST', { email: 'a@b.com' });
      const res = await handler(req, { params: { objectstack: ['auth', 'login'] } });
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleAuth).toHaveBeenCalled();
    });
  });

  describe('GraphQL Endpoint', () => {
    it('POST graphql calls handleGraphQL', async () => {
      const handler = createRouteHandler({ kernel: mockKernel });
      const body = { query: '{ objects { name } }' };
      const req = makeReq('http://localhost/api/graphql', 'POST', body);
      const res = await handler(req, { params: { objectstack: ['graphql'] } });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: {} });
      expect(mockDispatcher.handleGraphQL).toHaveBeenCalledWith(
        body,
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('returns error on handleGraphQL exception', async () => {
      mockDispatcher.handleGraphQL.mockRejectedValueOnce(new Error('Parse error'));
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/graphql', 'POST', { query: 'bad' });
      const res = await handler(req, { params: { objectstack: ['graphql'] } });
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Parse error');
    });
  });

  describe('Metadata Endpoint', () => {
    it('GET meta/objects calls handleMetadata', async () => {
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/meta/objects', 'GET');
      const res = await handler(req, { params: { objectstack: ['meta', 'objects'] } });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ objects: [] });
      expect(mockDispatcher.handleMetadata).toHaveBeenCalledWith(
        'objects',
        expect.objectContaining({ request: expect.anything() }),
        'GET',
        undefined,
      );
    });

    it('PUT meta/objects parses JSON body', async () => {
      const handler = createRouteHandler({ kernel: mockKernel });
      const body = { name: 'test_object' };
      const req = makeReq('http://localhost/api/meta/objects', 'PUT', body);
      const res = await handler(req, { params: { objectstack: ['meta', 'objects'] } });
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleMetadata).toHaveBeenCalledWith(
        'objects',
        expect.objectContaining({ request: expect.anything() }),
        'PUT',
        body,
      );
    });

    it('POST meta/objects parses JSON body', async () => {
      const handler = createRouteHandler({ kernel: mockKernel });
      const body = { label: 'My Object' };
      const req = makeReq('http://localhost/api/meta/objects', 'POST', body);
      const res = await handler(req, { params: { objectstack: ['meta', 'objects'] } });
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleMetadata).toHaveBeenCalledWith(
        'objects',
        expect.objectContaining({ request: expect.anything() }),
        'POST',
        body,
      );
    });
  });

  describe('Data Endpoint', () => {
    it('GET data/account calls handleData', async () => {
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/data/account', 'GET');
      const res = await handler(req, { params: { objectstack: ['data', 'account'] } });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ records: [] });
      expect(mockDispatcher.handleData).toHaveBeenCalledWith(
        'account',
        'GET',
        {},
        expect.any(Object),
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('POST data/account parses JSON body', async () => {
      const handler = createRouteHandler({ kernel: mockKernel });
      const body = { name: 'Acme' };
      const req = makeReq('http://localhost/api/data/account', 'POST', body);
      const res = await handler(req, { params: { objectstack: ['data', 'account'] } });
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleData).toHaveBeenCalledWith(
        'account',
        'POST',
        body,
        expect.any(Object),
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('PATCH data/account parses JSON body', async () => {
      const handler = createRouteHandler({ kernel: mockKernel });
      const body = { name: 'Updated' };
      const req = makeReq('http://localhost/api/data/account', 'PATCH', body);
      const res = await handler(req, { params: { objectstack: ['data', 'account'] } });
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleData).toHaveBeenCalledWith(
        'account',
        'PATCH',
        body,
        expect.any(Object),
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('returns 404 when result is not handled', async () => {
      mockDispatcher.handleData.mockResolvedValueOnce({ handled: false });
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/data/missing', 'GET');
      const res = await handler(req, { params: { objectstack: ['data', 'missing'] } });
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Storage Endpoint', () => {
    it('GET storage/files calls handleStorage', async () => {
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/storage/files', 'GET');
      const res = await handler(req, { params: { objectstack: ['storage', 'files'] } });
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleStorage).toHaveBeenCalledWith(
        'files',
        'GET',
        undefined,
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('POST storage/upload calls handleStorage with file', async () => {
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/storage/upload', 'POST');
      const res = await handler(req, { params: { objectstack: ['storage', 'upload'] } });
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleStorage).toHaveBeenCalledWith(
        'upload',
        'POST',
        expect.objectContaining({ name: 'test.txt' }),
        expect.objectContaining({ request: expect.anything() }),
      );
    });
  });

  describe('Error Handling', () => {
    it('returns 404 for unknown route segments', async () => {
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/unknown/path', 'GET');
      const res = await handler(req, { params: { objectstack: ['unknown', 'path'] } });
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Not Found');
    });

    it('returns 500 with default message on generic error', async () => {
      mockDispatcher.handleData.mockRejectedValueOnce(new Error());
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/data/account', 'GET');
      const res = await handler(req, { params: { objectstack: ['data', 'account'] } });
      expect(res.status).toBe(500);
      expect(res.body.error.message).toBe('Internal Server Error');
    });

    it('uses custom statusCode from error', async () => {
      mockDispatcher.handleData.mockRejectedValueOnce(
        Object.assign(new Error('Forbidden'), { statusCode: 403 }),
      );
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/data/account', 'GET');
      const res = await handler(req, { params: { objectstack: ['data', 'account'] } });
      expect(res.status).toBe(403);
      expect(res.body.error.message).toBe('Forbidden');
    });
  });

  describe('toResponse', () => {
    it('handles redirect result', async () => {
      mockDispatcher.handleData.mockResolvedValueOnce({
        handled: true,
        result: { type: 'redirect', url: 'https://example.com' },
      });
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/data/redir', 'GET');
      const res = await handler(req, { params: { objectstack: ['data', 'redir'] } });
      expect((res as any).redirectUrl).toBe('https://example.com');
    });

    it('handles stream result', async () => {
      const stream = 'mock-stream';
      mockDispatcher.handleData.mockResolvedValueOnce({
        handled: true,
        result: { type: 'stream', stream, headers: { 'Content-Type': 'text/plain' } },
      });
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/data/stream', 'GET');
      const res = await handler(req, { params: { objectstack: ['data', 'stream'] } });
      expect(res.body).toBe('mock-stream');
      expect(res.status).toBe(200);
    });

    it('returns raw result when handled but no response/redirect/stream', async () => {
      const rawResult = { type: 'custom', data: 'test' };
      mockDispatcher.handleData.mockResolvedValueOnce({
        handled: true,
        result: rawResult,
      });
      const handler = createRouteHandler({ kernel: mockKernel });
      const req = makeReq('http://localhost/api/data/custom', 'GET');
      const res = await handler(req, { params: { objectstack: ['data', 'custom'] } });
      expect(res).toBe(rawResult);
    });
  });
});

describe('createDiscoveryHandler', () => {
  it('redirects to default /api path', async () => {
    const handler = createDiscoveryHandler({ kernel: mockKernel });
    const req = makeReq('http://localhost/.well-known/objectstack', 'GET');
    const res = await handler(req);
    expect((res as any).redirectUrl).toBe('http://localhost/api');
  });

  it('redirects to custom prefix', async () => {
    const handler = createDiscoveryHandler({ kernel: mockKernel, prefix: '/v2/api' });
    const req = makeReq('http://localhost/.well-known/objectstack', 'GET');
    const res = await handler(req);
    expect((res as any).redirectUrl).toBe('http://localhost/v2/api');
  });
});

// --- Server Actions Tests ---
import { createServerActions } from './index';

describe('createServerActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('query returns data on success', async () => {
    const actions = createServerActions({ kernel: mockKernel });
    const result = await actions.query('account');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ records: [] });
    expect(mockDispatcher.handleData).toHaveBeenCalledWith(
      '/account', 'GET', {}, {},
      expect.anything(),
    );
  });

  it('query passes params', async () => {
    const actions = createServerActions({ kernel: mockKernel });
    await actions.query('account', { limit: 10 });
    expect(mockDispatcher.handleData).toHaveBeenCalledWith(
      '/account', 'GET', {}, { limit: 10 },
      expect.anything(),
    );
  });

  it('getById returns single record', async () => {
    const actions = createServerActions({ kernel: mockKernel });
    const result = await actions.getById('account', '123');
    expect(result.success).toBe(true);
    expect(mockDispatcher.handleData).toHaveBeenCalledWith(
      '/account/123', 'GET', {}, {},
      expect.anything(),
    );
  });

  it('create sends data', async () => {
    const actions = createServerActions({ kernel: mockKernel });
    const result = await actions.create('account', { name: 'Acme' });
    expect(result.success).toBe(true);
    expect(mockDispatcher.handleData).toHaveBeenCalledWith(
      '/account', 'POST', { name: 'Acme' }, {},
      expect.anything(),
    );
  });

  it('update sends data with id', async () => {
    const actions = createServerActions({ kernel: mockKernel });
    const result = await actions.update('account', '123', { name: 'Updated' });
    expect(result.success).toBe(true);
    expect(mockDispatcher.handleData).toHaveBeenCalledWith(
      '/account/123', 'PATCH', { name: 'Updated' }, {},
      expect.anything(),
    );
  });

  it('remove deletes record', async () => {
    const actions = createServerActions({ kernel: mockKernel });
    const result = await actions.remove('account', '123');
    expect(result.success).toBe(true);
    expect(mockDispatcher.handleData).toHaveBeenCalledWith(
      '/account/123', 'DELETE', {}, {},
      expect.anything(),
    );
  });

  it('getMetadata returns metadata', async () => {
    const actions = createServerActions({ kernel: mockKernel });
    const result = await actions.getMetadata('/objects');
    expect(result.success).toBe(true);
    expect(mockDispatcher.handleMetadata).toHaveBeenCalledWith(
      '/objects', expect.anything(), 'GET',
    );
  });

  it('returns error on exception', async () => {
    mockDispatcher.handleData.mockRejectedValueOnce(new Error('Server down'));
    const actions = createServerActions({ kernel: mockKernel });
    const result = await actions.query('account');
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Server down');
  });

  it('returns error when not handled', async () => {
    mockDispatcher.handleData.mockResolvedValueOnce({ handled: false });
    const actions = createServerActions({ kernel: mockKernel });
    const result = await actions.query('missing');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(404);
  });
});
