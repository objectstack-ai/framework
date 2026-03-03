// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock dispatcher instance accessible across tests
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

import { objectStackMiddleware, createHonoApp } from './index';

const mockKernel = { name: 'test-kernel' } as any;

describe('objectStackMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets kernel on context via c.set', async () => {
    const app = new Hono();
    const middleware = objectStackMiddleware(mockKernel);

    app.use('*', middleware);
    app.get('/test', (c) => {
      const kernel = c.get('objectStack');
      return c.json({ hasKernel: !!kernel });
    });

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hasKernel).toBe(true);
  });

  it('calls next middleware', async () => {
    const app = new Hono();
    const middleware = objectStackMiddleware(mockKernel);
    const spy = vi.fn();

    app.use('*', middleware);
    app.use('*', async (_c, next) => {
      spy();
      await next();
    });
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalled();
  });

  it('provides the correct kernel instance', async () => {
    const app = new Hono();
    const middleware = objectStackMiddleware(mockKernel);

    app.use('*', middleware);
    app.get('/test', (c) => {
      const kernel = c.get('objectStack');
      return c.json({ name: kernel.name });
    });

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('test-kernel');
  });
});

describe('createHonoApp', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createHonoApp({ kernel: mockKernel });
  });

  describe('Discovery Endpoint', () => {
    it('GET /api returns discovery info', async () => {
      const res = await app.request('/api');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.version).toBe('1.0');
      expect(mockDispatcher.getDiscoveryInfo).toHaveBeenCalledWith('/api');
    });

    it('uses custom prefix for discovery', async () => {
      const customApp = createHonoApp({ kernel: mockKernel, prefix: '/v2' });
      const res = await customApp.request('/v2');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(mockDispatcher.getDiscoveryInfo).toHaveBeenCalledWith('/v2');
    });
  });

  describe('.well-known Endpoint', () => {
    it('GET /.well-known/objectstack redirects to prefix', async () => {
      const res = await app.request('/.well-known/objectstack', { redirect: 'manual' });
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('/api');
    });
  });

  describe('Auth Endpoint', () => {
    it('POST /api/auth/login calls handleAuth', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(mockDispatcher.handleAuth).toHaveBeenCalledWith(
        'login',
        'POST',
        { email: 'a@b.com' },
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('GET /api/auth/callback calls handleAuth with empty body', async () => {
      const res = await app.request('/api/auth/callback');
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
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toBe('Unauthorized');
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
      const authApp = createHonoApp({ kernel: kernelWithAuth });
      const res = await authApp.request('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'pass' }),
      });
      expect(res.status).toBe(200);
      expect(kernelWithAuth.getService).toHaveBeenCalledWith('auth');
      expect(mockHandleRequest).toHaveBeenCalled();
    });

    it('falls back to dispatcher when auth service is not available', async () => {
      const kernelWithoutAuth = {
        ...mockKernel,
        getService: vi.fn().mockReturnValue(null),
      };
      const authApp = createHonoApp({ kernel: kernelWithoutAuth });
      const res = await authApp.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com' }),
      });
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleAuth).toHaveBeenCalled();
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
      const authApp = createHonoApp({ kernel: kernelWithAsyncAuth });
      const res = await authApp.request('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'pass' }),
      });
      expect(res.status).toBe(200);
      expect(kernelWithAsyncAuth.getServiceAsync).toHaveBeenCalledWith('auth');
      expect(mockHandleRequest).toHaveBeenCalled();
    });

    it('falls back to dispatcher when getServiceAsync throws (async factory error)', async () => {
      const kernelWithFailingAsync = {
        ...mockKernel,
        getServiceAsync: vi.fn().mockRejectedValue(new Error("Service 'auth' not found")),
      };
      const authApp = createHonoApp({ kernel: kernelWithFailingAsync });
      const res = await authApp.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com' }),
      });
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleAuth).toHaveBeenCalled();
    });
  });

  describe('GraphQL Endpoint', () => {
    it('POST /api/graphql calls handleGraphQL', async () => {
      const body = { query: '{ objects { name } }' };
      const res = await app.request('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(mockDispatcher.handleGraphQL).toHaveBeenCalledWith(
        body,
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('returns error on handleGraphQL exception', async () => {
      mockDispatcher.handleGraphQL.mockRejectedValueOnce(new Error('Parse error'));
      const res = await app.request('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'bad' }),
      });
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toBe('Parse error');
    });
  });

  describe('Metadata Endpoint', () => {
    it('GET /api/meta/objects calls handleMetadata', async () => {
      const res = await app.request('/api/meta/objects');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.objects).toBeDefined();
      expect(mockDispatcher.handleMetadata).toHaveBeenCalledWith(
        '/objects',
        expect.objectContaining({ request: expect.anything() }),
        'GET',
        undefined,
      );
    });

    it('PUT /api/meta/objects parses JSON body', async () => {
      const body = { name: 'test_object' };
      const res = await app.request('/api/meta/objects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleMetadata).toHaveBeenCalledWith(
        '/objects',
        expect.objectContaining({ request: expect.anything() }),
        'PUT',
        body,
      );
    });

    it('GET /api/meta with no trailing path', async () => {
      const res = await app.request('/api/meta');
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleMetadata).toHaveBeenCalledWith(
        '',
        expect.objectContaining({ request: expect.anything() }),
        'GET',
        undefined,
      );
    });
  });

  describe('Data Endpoint', () => {
    it('GET /api/data/account calls handleData', async () => {
      const res = await app.request('/api/data/account');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.records).toBeDefined();
      expect(mockDispatcher.handleData).toHaveBeenCalledWith(
        '/account',
        'GET',
        {},
        expect.any(Object),
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('POST /api/data/account parses JSON body', async () => {
      const body = { name: 'Acme' };
      const res = await app.request('/api/data/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleData).toHaveBeenCalledWith(
        '/account',
        'POST',
        body,
        expect.any(Object),
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('PATCH /api/data/account parses JSON body', async () => {
      const body = { name: 'Updated' };
      const res = await app.request('/api/data/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleData).toHaveBeenCalledWith(
        '/account',
        'PATCH',
        body,
        expect.any(Object),
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('returns 404 when result is not handled', async () => {
      mockDispatcher.handleData.mockResolvedValueOnce({ handled: false });
      const res = await app.request('/api/data/missing');
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('Storage Endpoint', () => {
    it('GET /api/storage/files calls handleStorage', async () => {
      const res = await app.request('/api/storage/files');
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleStorage).toHaveBeenCalledWith(
        '/files',
        'GET',
        undefined,
        expect.objectContaining({ request: expect.anything() }),
      );
    });
  });

  describe('Error Handling', () => {
    it('returns 500 with default message on generic error', async () => {
      mockDispatcher.handleData.mockRejectedValueOnce(new Error());
      const res = await app.request('/api/data/account');
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error.message).toBe('Internal Server Error');
    });

    it('uses custom statusCode from error', async () => {
      mockDispatcher.handleData.mockRejectedValueOnce(
        Object.assign(new Error('Forbidden'), { statusCode: 403 }),
      );
      const res = await app.request('/api/data/account');
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.message).toBe('Forbidden');
    });
  });

  describe('toResponse', () => {
    it('handles redirect result', async () => {
      mockDispatcher.handleData.mockResolvedValueOnce({
        handled: true,
        result: { type: 'redirect', url: 'https://example.com' },
      });
      const res = await app.request('/api/data/redir', { redirect: 'manual' });
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('https://example.com');
    });

    it('handles generic result objects with 200 status', async () => {
      mockDispatcher.handleData.mockResolvedValueOnce({
        handled: true,
        result: { foo: 'bar' },
      });
      const res = await app.request('/api/data/custom');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.foo).toBe('bar');
    });

    it('sets custom headers from response', async () => {
      mockDispatcher.handleData.mockResolvedValueOnce({
        handled: true,
        response: { status: 201, body: { id: 1 }, headers: { 'X-Custom': 'yes' } },
      });
      const res = await app.request('/api/data/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      });
      expect(res.status).toBe(201);
      expect(res.headers.get('X-Custom')).toBe('yes');
      const json = await res.json();
      expect(json.id).toBe(1);
    });
  });
});
