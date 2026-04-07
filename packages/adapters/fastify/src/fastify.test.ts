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

import Fastify from 'fastify';
import { objectStackPlugin, objectStackDecorator } from './index';

const mockKernel = { name: 'test-kernel' } as any;

describe('objectStackPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers discovery route', async () => {
    const app = Fastify();
    await app.register(objectStackPlugin, { kernel: mockKernel });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api' });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.data).toBeDefined();
    expect(json.data.version).toBe('1.0');
    expect(mockDispatcher.getDiscoveryInfo).toHaveBeenCalledWith('/api');
  });

  it('registers auth route', async () => {
    const app = Fastify();
    await app.register(objectStackPlugin, { kernel: mockKernel });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'a@b.com' },
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.ok).toBe(true);
    expect(mockDispatcher.handleAuth).toHaveBeenCalledWith(
      'login',
      'POST',
      { email: 'a@b.com' },
      expect.objectContaining({ request: expect.anything() }),
    );
  });

  it('registers graphql route', async () => {
    const app = Fastify();
    await app.register(objectStackPlugin, { kernel: mockKernel });
    await app.ready();

    const body = { query: '{ objects { name } }' };
    const res = await app.inject({
      method: 'POST',
      url: '/api/graphql',
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.data).toBeDefined();
    expect(mockDispatcher.handleGraphQL).toHaveBeenCalledWith(
      body,
      expect.objectContaining({ request: expect.anything() }),
    );
  });

  it('registers metadata route', async () => {
    const app = Fastify();
    await app.register(objectStackPlugin, { kernel: mockKernel });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/meta/objects' });
    expect(res.statusCode).toBe(200);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'GET',
      '/meta/objects',
      undefined,
      expect.any(Object),
      expect.objectContaining({ request: expect.anything() }),
      '/api',
    );
  });

  it('registers data route', async () => {
    const app = Fastify();
    await app.register(objectStackPlugin, { kernel: mockKernel });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/data/account' });
    expect(res.statusCode).toBe(200);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'GET',
      '/data/account',
      undefined,
      expect.any(Object),
      expect.objectContaining({ request: expect.anything() }),
      '/api',
    );
  });

  it('registers storage route', async () => {
    const app = Fastify();
    await app.register(objectStackPlugin, { kernel: mockKernel });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/storage/files' });
    expect(res.statusCode).toBe(200);
    expect(mockDispatcher.handleStorage).toHaveBeenCalledWith(
      '/files',
      'GET',
      undefined,
      expect.objectContaining({ request: expect.anything() }),
    );
  });

  it('uses custom prefix', async () => {
    const app = Fastify();
    // Pass prefix as part of options but not via Fastify's built-in prefix
    await app.register(async (instance) => {
      await objectStackPlugin(instance, { kernel: mockKernel, prefix: '/v2' });
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/v2' });
    expect(res.statusCode).toBe(200);
    expect(mockDispatcher.getDiscoveryInfo).toHaveBeenCalledWith('/v2');
  });

  it('returns error on exception', async () => {
    mockDispatcher.dispatch.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), { statusCode: 403 }),
    );
    const app = Fastify();
    await app.register(objectStackPlugin, { kernel: mockKernel });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/data/account' });
    expect(res.statusCode).toBe(403);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(false);
    expect(json.error.message).toBe('Forbidden');
  });
});

describe('objectStackDecorator', () => {
  it('attaches kernel to request via hook', async () => {
    const app = Fastify();
    // The decorator plugin adds an onRequest hook
    const decoratorPlugin = objectStackDecorator(mockKernel);
    await decoratorPlugin(app);

    let capturedKernel: any = null;
    app.get('/test', async (request) => {
      capturedKernel = (request as any).objectStack;
      return { ok: true };
    });

    await app.ready();
    await app.inject({ method: 'GET', url: '/test' });
    expect(capturedKernel).toBe(mockKernel);
  });
});
