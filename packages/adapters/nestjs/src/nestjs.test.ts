// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock NestJS decorators as no-ops
vi.mock('@nestjs/common', () => {
  const classDecorator = () => (target: any) => target;
  const methodDecorator = () => (_target: any, _key: string, descriptor: PropertyDescriptor) => descriptor;
  const paramDecorator = () => () => (_target: any, _key: string, _index: number) => {};
  return {
    Module: classDecorator,
    Global: () => (target: any) => target,
    Controller: (_prefix?: string) => (target: any) => target,
    Injectable: () => (target: any) => target,
    Inject: (_token: any) => (_target: any, _key: string | undefined, _index: number) => {},
    DynamicModule: class {},
    Post: methodDecorator,
    Get: methodDecorator,
    All: methodDecorator,
    Body: paramDecorator,
    Query: paramDecorator,
    Req: paramDecorator,
    Res: paramDecorator,
    createParamDecorator: (_fn: any) => () => (_target: any, _key: string, _index: number) => {},
    ExecutionContext: class {},
    Provider: class {},
  };
});

import {
  OBJECT_KERNEL,
  ObjectStackModule,
  ObjectStackService,
  ObjectStackController,
  DiscoveryController,
} from './index.js';

// --- Helpers ---

function createMockKernel() {
  return { id: 'test-kernel' } as any;
}

function createMockRes() {
  const res: any = {
    _status: 200,
    _body: null,
    _headers: {} as Record<string, string>,
    _redirectUrl: null as string | null,
    status(code: number) { res._status = code; return res; },
    json(body: any) { res._body = body; return res; },
    send(body: any) { res._body = body; return res; },
    setHeader(k: string, v: string) { res._headers[k] = v; return res; },
    redirect(url: string) { res._redirectUrl = url; return res; },
  };
  return res;
}

// --- Tests ---

describe('OBJECT_KERNEL constant', () => {
  it('is exported as a string token', () => {
    expect(OBJECT_KERNEL).toBe('OBJECT_KERNEL');
  });
});

describe('ObjectStackModule', () => {
  it('forRoot returns a DynamicModule with correct shape', () => {
    const kernel = createMockKernel();
    const mod = ObjectStackModule.forRoot(kernel);

    expect(mod).toBeDefined();
    expect(mod.module).toBe(ObjectStackModule);
    expect(mod.controllers).toContain(ObjectStackController);
    expect(mod.controllers).toContain(DiscoveryController);
    expect(mod.providers).toHaveLength(2);
    expect(mod.exports).toHaveLength(2);
  });

  it('forRoot provides the kernel under OBJECT_KERNEL token', () => {
    const kernel = createMockKernel();
    const mod = ObjectStackModule.forRoot(kernel);

    const kernelProvider = (mod.providers as any[])?.find(
      (p: any) => p.provide === OBJECT_KERNEL,
    );
    expect(kernelProvider).toBeDefined();
    expect(kernelProvider.useValue).toBe(kernel);
  });

  it('forRoot exports ObjectStackService', () => {
    const kernel = createMockKernel();
    const mod = ObjectStackModule.forRoot(kernel);

    expect(mod.exports).toContain(ObjectStackService);
  });
});

describe('ObjectStackService', () => {
  let service: ObjectStackService;
  let kernel: any;

  beforeEach(() => {
    kernel = createMockKernel();
    service = new ObjectStackService(kernel);
  });

  it('creates an HttpDispatcher on construction', () => {
    expect(service.dispatcher).toBeDefined();
  });

  it('getKernel returns the injected kernel', () => {
    expect(service.getKernel()).toBe(kernel);
  });
});

describe('ObjectStackController', () => {
  let controller: ObjectStackController;
  let service: ObjectStackService;
  let res: ReturnType<typeof createMockRes>;

  beforeEach(() => {
    const kernel = createMockKernel();
    service = new ObjectStackService(kernel);
    controller = new ObjectStackController(service);
    res = createMockRes();
  });

  it('has all expected route handler methods', () => {
    expect(typeof controller.discovery).toBe('function');
    expect(typeof controller.graphql).toBe('function');
    expect(typeof controller.auth).toBe('function');
    expect(typeof controller.metadata).toBe('function');
    expect(typeof controller.data).toBe('function');
    expect(typeof controller.storage).toBe('function');
  });

  describe('discovery()', () => {
    it('returns discovery info from the dispatcher', async () => {
      const result = await controller.discovery();
      expect(result).toEqual({ data: { version: '1.0' } });
      expect(service.dispatcher.getDiscoveryInfo).toHaveBeenCalledWith('/api');
    });
  });

  describe('graphql()', () => {
    it('dispatches to handleGraphQL and returns json', async () => {
      const req = { headers: {} };
      const body = { query: '{ objects { name } }' };

      await controller.graphql(body, req, res);

      expect(service.dispatcher.handleGraphQL).toHaveBeenCalledWith(body, { request: req });
      expect(res._body).toEqual({ data: {} });
    });

    it('handles errors from handleGraphQL', async () => {
      (service.dispatcher.handleGraphQL as any).mockRejectedValueOnce(
        Object.assign(new Error('GQL Error'), { statusCode: 400 }),
      );

      await controller.graphql({}, {}, res);

      expect(res._status).toBe(400);
      expect(res._body.success).toBe(false);
      expect(res._body.error.message).toBe('GQL Error');
    });
  });

  describe('auth()', () => {
    it('dispatches to handleAuth with extracted path', async () => {
      const req = { params: { 0: 'login' }, url: '/api/auth/login', method: 'POST' };
      const body = { username: 'admin' };

      await controller.auth(req, res, body);

      expect(service.dispatcher.handleAuth).toHaveBeenCalledWith(
        'login', 'POST', body, { request: req, response: res },
      );
    });

    it('falls back to URL parsing for path extraction', async () => {
      const req = { params: {}, url: '/api/auth/callback?code=abc', method: 'GET' };

      await controller.auth(req, res, {});

      expect(service.dispatcher.handleAuth).toHaveBeenCalledWith(
        'callback', 'GET', {}, { request: req, response: res },
      );
    });
  });

  describe('auth() via AuthPlugin service', () => {
    it('uses kernel.getService("auth") when available', async () => {
      const mockHandleRequest = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ user: { id: '1' } }), {
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
        }),
      );
      const kernelWithAuth = {
        ...createMockKernel(),
        getService: vi.fn().mockReturnValue({ handleRequest: mockHandleRequest }),
      };
      const svc = new ObjectStackService(kernelWithAuth);
      const ctrl = new ObjectStackController(svc);
      const r = createMockRes();
      const req = {
        params: { 0: 'sign-in/email' },
        url: '/api/auth/sign-in/email',
        method: 'POST',
        protocol: 'http',
        get: (key: string) => key === 'host' ? 'localhost' : undefined,
        headers: { 'content-type': 'application/json' },
        originalUrl: '/api/auth/sign-in/email',
      };

      await ctrl.auth(req, r, { email: 'a@b.com', password: 'pass' });

      expect(kernelWithAuth.getService).toHaveBeenCalledWith('auth');
      expect(mockHandleRequest).toHaveBeenCalledWith(expect.any(Request));
      expect(r._status).toBe(200);
    });

    it('falls back to dispatcher when auth service is not available', async () => {
      const kernelWithoutAuth = {
        ...createMockKernel(),
        getService: vi.fn().mockReturnValue(null),
      };
      const svc = new ObjectStackService(kernelWithoutAuth);
      const ctrl = new ObjectStackController(svc);
      const r = createMockRes();
      const req = { params: { 0: 'login' }, url: '/api/auth/login', method: 'POST' };

      await ctrl.auth(req, r, { email: 'a@b.com' });

      expect(svc.dispatcher.handleAuth).toHaveBeenCalled();
    });

    it('forwards GET requests to auth service', async () => {
      const mockHandleRequest = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ session: { token: 'abc' } }), {
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
        }),
      );
      const kernelWithAuth = {
        ...createMockKernel(),
        getService: vi.fn().mockReturnValue({ handleRequest: mockHandleRequest }),
      };
      const svc = new ObjectStackService(kernelWithAuth);
      const ctrl = new ObjectStackController(svc);
      const r = createMockRes();
      const req = {
        params: { 0: 'get-session' },
        url: '/api/auth/get-session',
        method: 'GET',
        protocol: 'http',
        get: (key: string) => key === 'host' ? 'localhost' : undefined,
        headers: {},
        originalUrl: '/api/auth/get-session',
      };

      await ctrl.auth(req, r, {});

      expect(mockHandleRequest).toHaveBeenCalled();
      expect(r._status).toBe(200);
    });

    it('returns error when auth service throws', async () => {
      const mockHandleRequest = vi.fn().mockRejectedValue(new Error('Auth failed'));
      const kernelWithAuth = {
        ...createMockKernel(),
        getService: vi.fn().mockReturnValue({ handleRequest: mockHandleRequest }),
      };
      const svc = new ObjectStackService(kernelWithAuth);
      const ctrl = new ObjectStackController(svc);
      const r = createMockRes();
      const req = {
        params: { 0: 'sign-in/email' },
        url: '/api/auth/sign-in/email',
        method: 'POST',
        protocol: 'http',
        get: (key: string) => key === 'host' ? 'localhost' : undefined,
        headers: {},
        originalUrl: '/api/auth/sign-in/email',
      };

      await ctrl.auth(req, r, {});

      expect(r._status).toBe(500);
      expect(r._body.success).toBe(false);
    });
  });

  describe('metadata()', () => {
    it('dispatches to dispatch with extracted path', async () => {
      const req = { params: { 0: '' }, url: '/api/meta/objects', method: 'GET' };

      await controller.metadata(req, res, undefined);

      expect(service.dispatcher.dispatch).toHaveBeenCalledWith(
        'GET', '/meta/objects', undefined, undefined, { request: req },
      );
    });
  });

  describe('data()', () => {
    it('dispatches to dispatch with extracted path', async () => {
      const req = { params: { 0: '' }, url: '/api/data/account', method: 'GET' };
      const query = { limit: '10' };

      await controller.data(req, res, {}, query);

      expect(service.dispatcher.dispatch).toHaveBeenCalledWith(
        'GET', '/data/account', {}, query, { request: req },
      );
    });
  });

  describe('storage()', () => {
    it('dispatches to handleStorage with extracted path', async () => {
      const req = { params: { 0: '' }, url: '/api/storage/files/test.png', method: 'GET', file: null, files: {} };

      await controller.storage(req, res);

      expect(service.dispatcher.handleStorage).toHaveBeenCalledWith(
        '/files/test.png', 'GET', undefined, { request: req },
      );
    });
  });

  describe('normalizeResponse (via handlers)', () => {
    it('returns 404 when result is not handled', async () => {
      (service.dispatcher.handleAuth as any).mockResolvedValueOnce({ handled: false });
      const req = { params: { 0: 'noop' }, url: '/api/auth/noop', method: 'GET' };

      await controller.auth(req, res, {});

      expect(res._status).toBe(404);
      expect(res._body.error.code).toBe(404);
    });

    it('sets custom headers from response', async () => {
      (service.dispatcher.dispatch as any).mockResolvedValueOnce({
        handled: true,
        response: { status: 201, body: { id: 1 }, headers: { 'X-Custom': 'yes' } },
      });
      const req = { params: {}, url: '/api/data/account', method: 'POST' };

      await controller.data(req, res, {}, {});

      expect(res._status).toBe(201);
      expect(res._headers['X-Custom']).toBe('yes');
      expect(res._body).toEqual({ id: 1 });
    });

    it('handles redirect results', async () => {
      (service.dispatcher.handleAuth as any).mockResolvedValueOnce({
        handled: true,
        result: { type: 'redirect', url: 'https://example.com/callback' },
      });
      const req = { params: { 0: 'oauth' }, url: '/api/auth/oauth', method: 'GET' };

      await controller.auth(req, res, {});

      expect(res._redirectUrl).toBe('https://example.com/callback');
    });

    it('handles stream results', async () => {
      const pipeFn = vi.fn();
      (service.dispatcher.handleStorage as any).mockResolvedValueOnce({
        handled: true,
        result: {
          type: 'stream',
          stream: { pipe: pipeFn },
          headers: { 'Content-Type': 'application/octet-stream' },
        },
      });
      const req = { params: {}, url: '/api/storage/download', method: 'GET', file: null, files: {} };

      await controller.storage(req, res);

      expect(pipeFn).toHaveBeenCalledWith(res);
      expect(res._headers['Content-Type']).toBe('application/octet-stream');
    });

    it('handles generic result objects with 200 status', async () => {
      (service.dispatcher.dispatch as any).mockResolvedValueOnce({
        handled: true,
        result: { foo: 'bar' },
      });
      const req = { params: {}, url: '/api/data/x', method: 'GET' };

      await controller.data(req, res, {}, {});

      expect(res._status).toBe(200);
      expect(res._body).toEqual({ foo: 'bar' });
    });

    it('handles Response-like objects', async () => {
      const mockHeaders = new Map([['content-type', 'text/plain']]);
      (service.dispatcher.dispatch as any).mockResolvedValueOnce({
        handled: true,
        result: {
          status: 203,
          headers: mockHeaders,
          text: vi.fn().mockResolvedValue('hello world'),
        },
      });
      const req = { params: {}, url: '/api/data/x', method: 'GET' };

      await controller.data(req, res, {}, {});

      expect(res._status).toBe(203);
      expect(res._body).toBe('hello world');
    });
  });

  describe('handleError', () => {
    it('uses statusCode from error if available', async () => {
      (service.dispatcher.handleGraphQL as any).mockRejectedValueOnce(
        Object.assign(new Error('Forbidden'), { statusCode: 403, details: { reason: 'no access' } }),
      );

      await controller.graphql({}, {}, res);

      expect(res._status).toBe(403);
      expect(res._body.error.message).toBe('Forbidden');
      expect(res._body.error.details).toEqual({ reason: 'no access' });
    });

    it('defaults to 500 when no statusCode', async () => {
      (service.dispatcher.handleGraphQL as any).mockRejectedValueOnce(new Error('Unexpected'));

      await controller.graphql({}, {}, res);

      expect(res._status).toBe(500);
      expect(res._body.error.code).toBe(500);
    });
  });
});

describe('DiscoveryController', () => {
  it('redirects to /api', () => {
    const controller = new DiscoveryController();
    const res = createMockRes();

    controller.discover(res);

    expect(res._redirectUrl).toBe('/api');
  });
});
