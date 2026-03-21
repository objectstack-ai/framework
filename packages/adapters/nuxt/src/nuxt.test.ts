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

import { createApp, toNodeListener, createEvent } from 'h3';
import { createH3Router } from './index';
import http from 'node:http';

const mockKernel = { name: 'test-kernel' } as any;

function createTestApp() {
  const app = createApp();
  const router = createH3Router({ kernel: mockKernel });
  app.use(router);
  return app;
}

async function makeRequest(app: any, url: string, method = 'GET', body?: any) {
  const listener = toNodeListener(app);

  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address() as any;
      const reqOpts: http.RequestOptions = {
        hostname: 'localhost',
        port: addr.port,
        path: url,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
      };
      const req = http.request(reqOpts, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          server.close();
          try {
            resolve({ status: res.statusCode || 500, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode || 500, body: data });
          }
        });
      });
      req.on('error', (err) => { server.close(); reject(err); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

describe('createH3Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles discovery endpoint', async () => {
    const app = createTestApp();
    const res = await makeRequest(app, '/api');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.version).toBe('1.0');
    expect(mockDispatcher.getDiscoveryInfo).toHaveBeenCalledWith('/api');
  });

  it('handles auth route', async () => {
    const app = createTestApp();
    const res = await makeRequest(app, '/api/auth/login', 'POST', { email: 'a@b.com' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockDispatcher.handleAuth).toHaveBeenCalled();
  });

  it('handles graphql route', async () => {
    const app = createTestApp();
    const body = { query: '{ objects { name } }' };
    const res = await makeRequest(app, '/api/graphql', 'POST', body);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(mockDispatcher.handleGraphQL).toHaveBeenCalled();
  });

  it('handles metadata route', async () => {
    const app = createTestApp();
    const res = await makeRequest(app, '/api/meta/objects');
    expect(res.status).toBe(200);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'GET',
      '/meta/objects',
      undefined,
      expect.any(Object),
      expect.objectContaining({ request: expect.anything() }),
    );
  });

  it('handles data route', async () => {
    const app = createTestApp();
    const res = await makeRequest(app, '/api/data/account');
    expect(res.status).toBe(200);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'GET',
      '/data/account',
      undefined,
      expect.any(Object),
      expect.objectContaining({ request: expect.anything() }),
    );
  });

  it('handles storage route', async () => {
    const app = createTestApp();
    const res = await makeRequest(app, '/api/storage/files');
    expect(res.status).toBe(200);
    expect(mockDispatcher.handleStorage).toHaveBeenCalled();
  });

  it('handles errors', async () => {
    mockDispatcher.dispatch.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), { statusCode: 403 }),
    );
    const app = createTestApp();
    const res = await makeRequest(app, '/api/data/account');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Forbidden');
  });
});
