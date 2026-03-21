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

import { createRequestHandler, createHandle } from './index';

const mockKernel = { name: 'test-kernel' } as any;

function makeEvent(url: string, method = 'GET', body?: any): any {
  const parsedUrl = new URL(url, 'http://localhost');
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return {
    request: new Request(parsedUrl, init),
    url: parsedUrl,
    params: {},
  };
}

describe('createRequestHandler', () => {
  let handler: ReturnType<typeof createRequestHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = createRequestHandler({ kernel: mockKernel });
  });

  describe('Discovery', () => {
    it('GET /api returns discovery info', async () => {
      const event = makeEvent('http://localhost/api');
      const res = await handler(event);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.version).toBe('1.0');
      expect(mockDispatcher.getDiscoveryInfo).toHaveBeenCalledWith('/api');
    });

    it('uses custom prefix', async () => {
      const customHandler = createRequestHandler({ kernel: mockKernel, prefix: '/v2' });
      const event = makeEvent('http://localhost/v2');
      const res = await customHandler(event);
      expect(res.status).toBe(200);
      expect(mockDispatcher.getDiscoveryInfo).toHaveBeenCalledWith('/v2');
    });
  });

  describe('Auth', () => {
    it('POST /api/auth/login calls handleAuth', async () => {
      const event = makeEvent('http://localhost/api/auth/login', 'POST', { email: 'a@b.com' });
      const res = await handler(event);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(mockDispatcher.handleAuth).toHaveBeenCalledWith(
        'login', 'POST', { email: 'a@b.com' },
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('GET /api/auth/callback calls handleAuth with empty body', async () => {
      const event = makeEvent('http://localhost/api/auth/callback');
      const res = await handler(event);
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleAuth).toHaveBeenCalledWith(
        'callback', 'GET', {},
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('returns error on exception', async () => {
      mockDispatcher.handleAuth.mockRejectedValueOnce(
        Object.assign(new Error('Unauthorized'), { statusCode: 401 }),
      );
      const event = makeEvent('http://localhost/api/auth/login', 'POST', {});
      const res = await handler(event);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
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
      const authHandler = createRequestHandler({ kernel: kernelWithAuth });
      const event = makeEvent('http://localhost/api/auth/sign-in/email', 'POST', { email: 'a@b.com' });
      const res = await authHandler(event);
      expect(res.status).toBe(200);
      expect(kernelWithAuth.getService).toHaveBeenCalledWith('auth');
      expect(mockHandleRequest).toHaveBeenCalled();
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
      const authHandler = createRequestHandler({ kernel: kernelWithAsyncAuth });
      const event = makeEvent('http://localhost/api/auth/sign-in/email', 'POST', { email: 'a@b.com' });
      const res = await authHandler(event);
      expect(res.status).toBe(200);
      expect(kernelWithAsyncAuth.getServiceAsync).toHaveBeenCalledWith('auth');
      expect(mockHandleRequest).toHaveBeenCalled();
    });

    it('falls back to dispatcher when getServiceAsync throws', async () => {
      const kernelWithFailingAsync = {
        ...mockKernel,
        getServiceAsync: vi.fn().mockRejectedValue(new Error("Service 'auth' not found")),
      };
      const authHandler = createRequestHandler({ kernel: kernelWithFailingAsync });
      const event = makeEvent('http://localhost/api/auth/login', 'POST', { email: 'a@b.com' });
      const res = await authHandler(event);
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleAuth).toHaveBeenCalled();
    });
  });

  describe('GraphQL', () => {
    it('POST /api/graphql calls handleGraphQL', async () => {
      const body = { query: '{ objects { name } }' };
      const event = makeEvent('http://localhost/api/graphql', 'POST', body);
      const res = await handler(event);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(mockDispatcher.handleGraphQL).toHaveBeenCalledWith(
        body, expect.objectContaining({ request: expect.anything() }),
      );
    });
  });

  describe('Metadata', () => {
    it('GET /api/meta/objects delegates to dispatch()', async () => {
      const event = makeEvent('http://localhost/api/meta/objects');
      const res = await handler(event);
      expect(res.status).toBe(200);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'GET',
        '/meta/objects',
        undefined,
        expect.any(Object),
        expect.objectContaining({ request: expect.anything() }),
      );
    });
  });

  describe('Data', () => {
    it('GET /api/data/account delegates to dispatch()', async () => {
      const event = makeEvent('http://localhost/api/data/account');
      const res = await handler(event);
      expect(res.status).toBe(200);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'GET',
        '/data/account',
        undefined,
        expect.any(Object),
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('POST /api/data/account parses body', async () => {
      const body = { name: 'Acme' };
      const event = makeEvent('http://localhost/api/data/account', 'POST', body);
      const res = await handler(event);
      expect(res.status).toBe(200);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'POST',
        '/data/account',
        body,
        expect.any(Object),
        expect.objectContaining({ request: expect.anything() }),
      );
    });

    it('returns 404 when not handled', async () => {
      mockDispatcher.dispatch.mockResolvedValueOnce({ handled: false });
      const event = makeEvent('http://localhost/api/data/missing');
      const res = await handler(event);
      expect(res.status).toBe(404);
    });
  });

  describe('Storage', () => {
    it('GET /api/storage/files calls handleStorage', async () => {
      const event = makeEvent('http://localhost/api/storage/files');
      const res = await handler(event);
      expect(res.status).toBe(200);
      expect(mockDispatcher.handleStorage).toHaveBeenCalledWith(
        '/files', 'GET', undefined,
        expect.objectContaining({ request: expect.anything() }),
      );
    });
  });

  describe('Error handling', () => {
    it('returns 404 for unknown routes', async () => {
      mockDispatcher.dispatch.mockResolvedValueOnce({ handled: false });
      const event = makeEvent('http://localhost/api/unknown');
      const res = await handler(event);
      expect(res.status).toBe(404);
    });

    it('returns 500 on generic error', async () => {
      mockDispatcher.dispatch.mockRejectedValueOnce(new Error());
      const event = makeEvent('http://localhost/api/data/account');
      const res = await handler(event);
      expect(res.status).toBe(500);
    });
  });

  describe('toResponse', () => {
    it('handles redirect result', async () => {
      mockDispatcher.dispatch.mockResolvedValueOnce({
        handled: true,
        result: { type: 'redirect', url: 'https://example.com' },
      });
      const event = makeEvent('http://localhost/api/data/redir');
      const res = await handler(event);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('https://example.com');
    });

    it('handles generic result objects', async () => {
      mockDispatcher.dispatch.mockResolvedValueOnce({
        handled: true,
        result: { foo: 'bar' },
      });
      const event = makeEvent('http://localhost/api/data/custom');
      const res = await handler(event);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.foo).toBe('bar');
    });
  });
});

describe('createHandle', () => {
  it('attaches kernel to event.locals', async () => {
    const handle = createHandle({ kernel: mockKernel });
    const event: any = { locals: {} };
    const resolve = vi.fn().mockResolvedValue(new Response('ok'));

    await handle({ event, resolve });

    expect(event.locals.objectStack).toBe(mockKernel);
    expect(resolve).toHaveBeenCalledWith(event);
  });
});
