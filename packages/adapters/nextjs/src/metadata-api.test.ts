// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/nextjs — Comprehensive Metadata API Integration Tests
 *
 * Validates that the Next.js adapter correctly routes ALL metadata API operations
 * defined by the @objectstack/metadata package through the HttpDispatcher.
 *
 * Covers: CRUD, Query, Bulk, Overlay, Import/Export, Validation, Type Registry, Dependencies
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dispatcher instance
const mockDispatcher = {
  getDiscoveryInfo: vi.fn().mockReturnValue({ version: '1.0', endpoints: [] }),
  handleAuth: vi.fn().mockResolvedValue({ handled: true, response: { body: { ok: true }, status: 200 } }),
  handleGraphQL: vi.fn().mockResolvedValue({ data: {} }),
  handleMetadata: vi.fn().mockResolvedValue({ handled: true, response: { body: { success: true }, status: 200 } }),
  handleData: vi.fn().mockResolvedValue({ handled: true, response: { body: { records: [] }, status: 200 } }),
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
      return new MockNextResponse(body, init);
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
import { createRouteHandler } from './index';

const mockKernel = { name: 'test-kernel' } as any;

function makeReq(url: string, method = 'GET', body?: any) {
  const init: any = { method };
  if (body) init.body = JSON.stringify(body);
  return new (NextRequest as any)(url, init);
}

describe('Next.js Metadata API Integration Tests', () => {
  let handler: ReturnType<typeof createRouteHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = createRouteHandler({ kernel: mockKernel });
  });

  // ==========================================
  // CRUD Operations
  // ==========================================

  describe('CRUD Operations', () => {
    describe('GET meta/objects — List all objects', () => {
      it('dispatches to dispatch with correct path', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: {
              success: true,
              data: [
                { name: 'account', label: 'Account' },
                { name: 'contact', label: 'Contact' },
              ],
            },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/objects');
        const res = await handler(req, { params: { objectstack: ['meta', 'objects'] } });
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'objects',
          expect.objectContaining({ request: expect.anything() }),
          'GET',
          undefined,
        );
      });
    });

    describe('GET meta/objects/account — Get single object', () => {
      it('dispatches to dispatch with item-level path', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: {
              success: true,
              data: { type: 'object', name: 'account', definition: { label: 'Account' } },
            },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/objects/account');
        const res = await handler(req, { params: { objectstack: ['meta', 'objects', 'account'] } });
        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('account');
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'objects/account',
          expect.objectContaining({ request: expect.anything() }),
          'GET',
          undefined,
        );
      });
    });

    describe('POST meta/objects — Register metadata', () => {
      it('dispatches POST with JSON body', async () => {
        const body = {
          type: 'object',
          name: 'project_task',
          data: { label: 'Project Task', fields: {} },
        };

        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: { body: { success: true }, status: 201 },
        });

        const req = makeReq('http://localhost/api/meta/objects', 'POST', body);
        const res = await handler(req, { params: { objectstack: ['meta', 'objects'] } });
        expect(res.status).toBe(201);
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'objects',
          expect.objectContaining({ request: expect.anything() }),
          'POST',
          body,
        );
      });
    });

    describe('PUT meta/objects/account — Update metadata', () => {
      it('dispatches PUT with JSON body', async () => {
        const body = { label: 'Updated Account' };

        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: { body: { success: true }, status: 200 },
        });

        const req = makeReq('http://localhost/api/meta/objects/account', 'PUT', body);
        const res = await handler(req, { params: { objectstack: ['meta', 'objects', 'account'] } });
        expect(res.status).toBe(200);
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'objects/account',
          expect.objectContaining({ request: expect.anything() }),
          'PUT',
          body,
        );
      });
    });

    describe('DELETE meta/objects/old_entity — Delete metadata', () => {
      it('dispatches DELETE to dispatch', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: { type: 'object', name: 'old_entity' } },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/objects/old_entity', 'DELETE');
        const res = await handler(req, { params: { objectstack: ['meta', 'objects', 'old_entity'] } });
        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('old_entity');
      });
    });

    describe('Multiple metadata types', () => {
      it('dispatches for views', async () => {
        const req = makeReq('http://localhost/api/meta/views');
        await handler(req, { params: { objectstack: ['meta', 'views'] } });
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'views',
          expect.objectContaining({ request: expect.anything() }),
          'GET',
          undefined,
        );
      });

      it('dispatches for flows', async () => {
        const req = makeReq('http://localhost/api/meta/flows');
        await handler(req, { params: { objectstack: ['meta', 'flows'] } });
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'flows',
          expect.objectContaining({ request: expect.anything() }),
          'GET',
          undefined,
        );
      });

      it('dispatches for agents', async () => {
        const req = makeReq('http://localhost/api/meta/agents');
        await handler(req, { params: { objectstack: ['meta', 'agents'] } });
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'agents',
          expect.objectContaining({ request: expect.anything() }),
          'GET',
          undefined,
        );
      });
    });
  });

  // ==========================================
  // Query / Search
  // ==========================================

  describe('Query / Search', () => {
    describe('POST meta/query — Advanced search', () => {
      it('dispatches query with full filter payload', async () => {
        const queryBody = {
          types: ['object', 'view'],
          search: 'account',
          page: 1,
          pageSize: 25,
        };

        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: {
              success: true,
              data: {
                items: [{ type: 'object', name: 'account' }],
                total: 1,
                page: 1,
                pageSize: 25,
              },
            },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/query', 'POST', queryBody);
        const res = await handler(req, { params: { objectstack: ['meta', 'query'] } });

        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(1);
      });
    });
  });

  // ==========================================
  // Bulk Operations
  // ==========================================

  describe('Bulk Operations', () => {
    describe('POST meta/bulk/register — Bulk register', () => {
      it('dispatches bulk register', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: { total: 2, succeeded: 2, failed: 0 } },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/bulk/register', 'POST', {
          items: [
            { type: 'object', name: 'customer', data: {} },
            { type: 'view', name: 'customer_list', data: {} },
          ],
        });
        const res = await handler(req, { params: { objectstack: ['meta', 'bulk', 'register'] } });

        expect(res.status).toBe(200);
        expect(res.body.data.succeeded).toBe(2);
      });
    });

    describe('POST meta/bulk/unregister — Bulk unregister', () => {
      it('dispatches bulk unregister', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: { total: 2, succeeded: 2, failed: 0 } },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/bulk/unregister', 'POST', {
          items: [{ type: 'object', name: 'old' }, { type: 'view', name: 'old_view' }],
        });
        const res = await handler(req, { params: { objectstack: ['meta', 'bulk', 'unregister'] } });

        expect(res.status).toBe(200);
        expect(res.body.data.succeeded).toBe(2);
      });
    });

    describe('Bulk operation with partial failures', () => {
      it('returns error details', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: {
              success: true,
              data: {
                total: 3,
                succeeded: 2,
                failed: 1,
                errors: [{ type: 'object', name: 'bad', error: 'Validation failed' }],
              },
            },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/bulk/register', 'POST', {
          items: [
            { type: 'object', name: 'good', data: {} },
            { type: 'object', name: 'good2', data: {} },
            { type: 'object', name: 'bad', data: {} },
          ],
          continueOnError: true,
        });
        const res = await handler(req, { params: { objectstack: ['meta', 'bulk', 'register'] } });

        expect(res.body.data.failed).toBe(1);
        expect(res.body.data.errors[0].name).toBe('bad');
      });
    });
  });

  // ==========================================
  // Overlay / Customization
  // ==========================================

  describe('Overlay / Customization', () => {
    describe('GET meta/objects/account/overlay — Get overlay', () => {
      it('dispatches overlay retrieval', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: {
              success: true,
              data: {
                id: 'overlay-001',
                baseType: 'object',
                baseName: 'account',
                scope: 'platform',
                patch: {},
              },
            },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/objects/account/overlay');
        const res = await handler(req, { params: { objectstack: ['meta', 'objects', 'account', 'overlay'] } });
        expect(res.status).toBe(200);
        expect(res.body.data.scope).toBe('platform');
      });
    });

    describe('PUT meta/objects/account/overlay — Save overlay', () => {
      it('dispatches overlay save', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: { body: { success: true }, status: 200 },
        });

        const req = makeReq('http://localhost/api/meta/objects/account/overlay', 'PUT', {
          id: 'overlay-002',
          baseType: 'object',
          baseName: 'account',
          patch: { fields: { status: { label: 'Custom' } } },
        });
        const res = await handler(req, { params: { objectstack: ['meta', 'objects', 'account', 'overlay'] } });
        expect(res.status).toBe(200);
      });
    });

    describe('GET meta/objects/account/effective — Get effective metadata', () => {
      it('dispatches effective metadata retrieval', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: {
              success: true,
              data: { name: 'account', fields: { status: { label: 'Custom Status' } } },
            },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/objects/account/effective');
        const res = await handler(req, { params: { objectstack: ['meta', 'objects', 'account', 'effective'] } });
        expect(res.status).toBe(200);
        expect(res.body.data.fields.status.label).toBe('Custom Status');
      });
    });
  });

  // ==========================================
  // Import / Export
  // ==========================================

  describe('Import / Export', () => {
    describe('POST meta/export — Export metadata', () => {
      it('dispatches export request', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: { version: '1.0', objects: {} } },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/export', 'POST', { types: ['object'], format: 'json' });
        const res = await handler(req, { params: { objectstack: ['meta', 'export'] } });
        expect(res.status).toBe(200);
        expect(res.body.data.version).toBe('1.0');
      });
    });

    describe('POST meta/import — Import metadata', () => {
      it('dispatches import request', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: { total: 3, imported: 3, skipped: 0, failed: 0 } },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/import', 'POST', {
          data: { objects: { a: {} } },
          conflictResolution: 'merge',
        });
        const res = await handler(req, { params: { objectstack: ['meta', 'import'] } });
        expect(res.status).toBe(200);
        expect(res.body.data.imported).toBe(3);
      });
    });
  });

  // ==========================================
  // Validation
  // ==========================================

  describe('Validation', () => {
    describe('POST meta/validate — Validate metadata', () => {
      it('dispatches validation', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: { valid: true } },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/validate', 'POST', { type: 'object', data: {} });
        const res = await handler(req, { params: { objectstack: ['meta', 'validate'] } });
        expect(res.status).toBe(200);
        expect(res.body.data.valid).toBe(true);
      });

      it('returns errors for invalid metadata', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: {
              success: true,
              data: {
                valid: false,
                errors: [{ path: 'name', message: 'Required', code: 'required' }],
              },
            },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/validate', 'POST', { type: 'object', data: {} });
        const res = await handler(req, { params: { objectstack: ['meta', 'validate'] } });
        expect(res.body.data.valid).toBe(false);
        expect(res.body.data.errors).toHaveLength(1);
      });
    });
  });

  // ==========================================
  // Type Registry
  // ==========================================

  describe('Type Registry', () => {
    describe('GET meta/types — List types', () => {
      it('returns all registered types', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: ['object', 'view', 'flow', 'agent'] },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/types');
        const res = await handler(req, { params: { objectstack: ['meta', 'types'] } });
        expect(res.status).toBe(200);
        expect(res.body.data).toContain('object');
      });
    });

    describe('GET meta/types/object — Get type info', () => {
      it('returns type metadata', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: {
              success: true,
              data: {
                type: 'object',
                label: 'Object',
                filePatterns: ['**/*.object.ts'],
                supportsOverlay: true,
                domain: 'data',
              },
            },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/types/object');
        const res = await handler(req, { params: { objectstack: ['meta', 'types', 'object'] } });
        expect(res.status).toBe(200);
        expect(res.body.data.domain).toBe('data');
      });
    });
  });

  // ==========================================
  // Dependency Tracking
  // ==========================================

  describe('Dependency Tracking', () => {
    describe('GET meta/objects/account/dependencies — Get dependencies', () => {
      it('returns dependencies', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: {
              success: true,
              data: [{
                sourceType: 'object',
                sourceName: 'account',
                targetType: 'object',
                targetName: 'organization',
                kind: 'reference',
              }],
            },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/objects/account/dependencies');
        const res = await handler(req, { params: { objectstack: ['meta', 'objects', 'account', 'dependencies'] } });
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
      });
    });

    describe('GET meta/objects/account/dependents — Get dependents', () => {
      it('returns dependents', async () => {
        mockDispatcher.dispatch.mockResolvedValueOnce({
          handled: true,
          response: {
            body: {
              success: true,
              data: [
                { sourceType: 'view', sourceName: 'account_list', targetType: 'object', targetName: 'account', kind: 'reference' },
                { sourceType: 'flow', sourceName: 'new_account', targetType: 'object', targetName: 'account', kind: 'triggers' },
              ],
            },
            status: 200,
          },
        });

        const req = makeReq('http://localhost/api/meta/objects/account/dependents');
        const res = await handler(req, { params: { objectstack: ['meta', 'objects', 'account', 'dependents'] } });
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
      });
    });
  });

  // ==========================================
  // Error Handling
  // ==========================================

  describe('Error Handling', () => {
    it('returns 404 when metadata not found', async () => {
      mockDispatcher.dispatch.mockResolvedValueOnce({ handled: false });

      const req = makeReq('http://localhost/api/meta/objects/nonexistent');
      const res = await handler(req, { params: { objectstack: ['meta', 'objects', 'nonexistent'] } });
      expect(res.status).toBe(404);
    });

    it('returns 500 on dispatcher exception', async () => {
      mockDispatcher.dispatch.mockRejectedValueOnce(new Error('Internal error'));

      const req = makeReq('http://localhost/api/meta/objects');
      const res = await handler(req, { params: { objectstack: ['meta', 'objects'] } });
      expect(res.status).toBe(500);
      expect(res.body.error.message).toBe('Internal error');
    });

    it('returns custom status code from error', async () => {
      mockDispatcher.dispatch.mockRejectedValueOnce(
        Object.assign(new Error('Forbidden'), { statusCode: 403 }),
      );

      const req = makeReq('http://localhost/api/meta/objects');
      const res = await handler(req, { params: { objectstack: ['meta', 'objects'] } });
      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // Path Parsing
  // ==========================================

  describe('Path Parsing', () => {
    it('correctly joins nested segments', async () => {
      const req = makeReq('http://localhost/api/meta/objects/account/fields/name');
      await handler(req, { params: { objectstack: ['meta', 'objects', 'account', 'fields', 'name'] } });
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'objects/account/fields/name',
        expect.any(Object),
        'GET',
        undefined,
      );
    });

    it('handles single segment meta path', async () => {
      const req = makeReq('http://localhost/api/meta');
      // With just ['meta'], subPath becomes empty after slice(1)
      await handler(req, { params: { objectstack: ['meta'] } });
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        '',
        expect.any(Object),
        'GET',
        undefined,
      );
    });
  });
});
