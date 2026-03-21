// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/nestjs — Comprehensive Metadata API Integration Tests
 *
 * Validates that the NestJS adapter correctly routes ALL metadata API operations
 * defined by the @objectstack/metadata package through the HttpDispatcher.
 *
 * Covers: CRUD, Query, Bulk, Overlay, Import/Export, Validation, Type Registry, Dependencies
 */

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
  ObjectStackService,
  ObjectStackController,
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

describe('NestJS Metadata API Integration Tests', () => {
  let controller: ObjectStackController;
  let service: ObjectStackService;
  let res: ReturnType<typeof createMockRes>;

  beforeEach(() => {
    const kernel = createMockKernel();
    service = new ObjectStackService(kernel);
    controller = new ObjectStackController(service);
    res = createMockRes();
  });

  // ==========================================
  // CRUD Operations
  // ==========================================

  describe('CRUD Operations', () => {
    describe('GET /api/meta/objects — List all objects', () => {
      it('dispatches to dispatch with correct path', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
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

        const req = { params: {}, url: '/api/meta/objects', method: 'GET' };
        await controller.metadata(req, res, undefined);

        expect(res._status).toBe(200);
        expect(res._body.data).toHaveLength(2);
        expect(service.dispatcher.dispatch).toHaveBeenCalledWith(
          'GET',
          '/meta/objects',
          undefined,
          undefined,
          { request: req },
        );
      });
    });

    describe('GET /api/meta/objects/account — Get single object', () => {
      it('dispatches with item-level path', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
          handled: true,
          response: {
            body: {
              success: true,
              data: { type: 'object', name: 'account', definition: { label: 'Account' } },
            },
            status: 200,
          },
        });

        const req = { params: {}, url: '/api/meta/objects/account', method: 'GET' };
        await controller.metadata(req, res, undefined);

        expect(res._body.data.name).toBe('account');
        expect(service.dispatcher.dispatch).toHaveBeenCalledWith(
          'GET',
          '/meta/objects/account',
          undefined,
          undefined,
          { request: req },
        );
      });
    });

    describe('POST /api/meta/objects — Register metadata', () => {
      it('dispatches POST with body', async () => {
        const body = { type: 'object', name: 'project_task', data: { label: 'Task' } };

        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
          handled: true,
          response: { body: { success: true }, status: 201 },
        });

        const req = { params: {}, url: '/api/meta/objects', method: 'POST', body };
        await controller.metadata(req, res, body);

        expect(res._status).toBe(201);
        expect(service.dispatcher.dispatch).toHaveBeenCalledWith(
          'POST',
          '/meta/objects',
          body,
          undefined,
          { request: req },
        );
      });
    });

    describe('PUT /api/meta/objects/account — Update metadata', () => {
      it('dispatches PUT with body', async () => {
        const body = { label: 'Updated Account' };

        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
          handled: true,
          response: { body: { success: true }, status: 200 },
        });

        const req = { params: {}, url: '/api/meta/objects/account', method: 'PUT', body };
        await controller.metadata(req, res, body);

        expect(res._status).toBe(200);
      });
    });

    describe('DELETE /api/meta/objects/old_entity — Delete metadata', () => {
      it('dispatches DELETE', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: { type: 'object', name: 'old_entity' } },
            status: 200,
          },
        });

        const req = { params: {}, url: '/api/meta/objects/old_entity', method: 'DELETE' };
        await controller.metadata(req, res, undefined);

        expect(res._body.data.name).toBe('old_entity');
      });
    });

    describe('Multiple metadata types', () => {
      it('dispatches for views', async () => {
        const req = { params: {}, url: '/api/meta/views', method: 'GET' };
        await controller.metadata(req, res, undefined);
        expect(service.dispatcher.dispatch).toHaveBeenCalledWith(
          'GET',
          '/meta/views',
          undefined,
          undefined,
          { request: req },
        );
      });

      it('dispatches for flows', async () => {
        const req = { params: {}, url: '/api/meta/flows', method: 'GET' };
        await controller.metadata(req, res, undefined);
        expect(service.dispatcher.dispatch).toHaveBeenCalledWith(
          'GET',
          '/meta/flows',
          undefined,
          undefined,
          { request: req },
        );
      });

      it('dispatches for agents', async () => {
        const req = { params: {}, url: '/api/meta/agents', method: 'GET' };
        await controller.metadata(req, res, undefined);
        expect(service.dispatcher.dispatch).toHaveBeenCalledWith(
          'GET',
          '/meta/agents',
          undefined,
          undefined,
          { request: req },
        );
      });
    });
  });

  // ==========================================
  // Query / Search
  // ==========================================

  describe('Query / Search', () => {
    describe('POST /api/meta/query — Advanced search', () => {
      it('dispatches query with payload', async () => {
        const body = {
          types: ['object', 'view'],
          search: 'account',
          page: 1,
          pageSize: 25,
        };

        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
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

        const req = { params: {}, url: '/api/meta/query', method: 'POST', body };
        await controller.metadata(req, res, body);

        expect(res._body.data.items).toHaveLength(1);
        expect(res._body.data.total).toBe(1);
      });
    });
  });

  // ==========================================
  // Bulk Operations
  // ==========================================

  describe('Bulk Operations', () => {
    describe('POST /api/meta/bulk/register — Bulk register', () => {
      it('dispatches bulk register', async () => {
        const body = {
          items: [
            { type: 'object', name: 'customer', data: {} },
            { type: 'view', name: 'customer_list', data: {} },
          ],
        };

        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: { total: 2, succeeded: 2, failed: 0 } },
            status: 200,
          },
        });

        const req = { params: {}, url: '/api/meta/bulk/register', method: 'POST', body };
        await controller.metadata(req, res, body);

        expect(res._body.data.succeeded).toBe(2);
      });
    });

    describe('POST /api/meta/bulk/unregister — Bulk unregister', () => {
      it('dispatches bulk unregister', async () => {
        const body = {
          items: [{ type: 'object', name: 'old' }],
        };

        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: { total: 1, succeeded: 1, failed: 0 } },
            status: 200,
          },
        });

        const req = { params: {}, url: '/api/meta/bulk/unregister', method: 'POST', body };
        await controller.metadata(req, res, body);

        expect(res._body.data.succeeded).toBe(1);
      });
    });

    describe('Bulk with partial failures', () => {
      it('returns error details', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
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

        const body = {
          items: [
            { type: 'object', name: 'good', data: {} },
            { type: 'object', name: 'good2', data: {} },
            { type: 'object', name: 'bad', data: {} },
          ],
          continueOnError: true,
        };
        const req = { params: {}, url: '/api/meta/bulk/register', method: 'POST', body };
        await controller.metadata(req, res, body);

        expect(res._body.data.failed).toBe(1);
        expect(res._body.data.errors[0].name).toBe('bad');
      });
    });
  });

  // ==========================================
  // Overlay / Customization
  // ==========================================

  describe('Overlay / Customization', () => {
    describe('GET /api/meta/objects/account/overlay — Get overlay', () => {
      it('dispatches overlay retrieval', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
          handled: true,
          response: {
            body: {
              success: true,
              data: {
                id: 'overlay-001',
                baseType: 'object',
                baseName: 'account',
                scope: 'platform',
              },
            },
            status: 200,
          },
        });

        const req = { params: {}, url: '/api/meta/objects/account/overlay', method: 'GET' };
        await controller.metadata(req, res, undefined);

        expect(res._body.data.scope).toBe('platform');
      });
    });

    describe('PUT /api/meta/objects/account/overlay — Save overlay', () => {
      it('dispatches overlay save', async () => {
        const body = {
          id: 'overlay-002',
          baseType: 'object',
          baseName: 'account',
          patch: { fields: { status: { label: 'Custom' } } },
        };

        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
          handled: true,
          response: { body: { success: true }, status: 200 },
        });

        const req = { params: {}, url: '/api/meta/objects/account/overlay', method: 'PUT', body };
        await controller.metadata(req, res, body);

        expect(res._status).toBe(200);
      });
    });

    describe('GET /api/meta/objects/account/effective — Get effective', () => {
      it('dispatches effective metadata retrieval', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
          handled: true,
          response: {
            body: {
              success: true,
              data: { name: 'account', fields: { status: { label: 'Custom Status' } } },
            },
            status: 200,
          },
        });

        const req = { params: {}, url: '/api/meta/objects/account/effective', method: 'GET' };
        await controller.metadata(req, res, undefined);

        expect(res._body.data.fields.status.label).toBe('Custom Status');
      });
    });
  });

  // ==========================================
  // Import / Export
  // ==========================================

  describe('Import / Export', () => {
    describe('POST /api/meta/export — Export metadata', () => {
      it('dispatches export request', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: { version: '1.0', objects: {} } },
            status: 200,
          },
        });

        const body = { types: ['object'], format: 'json' };
        const req = { params: {}, url: '/api/meta/export', method: 'POST', body };
        await controller.metadata(req, res, body);

        expect(res._body.data.version).toBe('1.0');
      });
    });

    describe('POST /api/meta/import — Import metadata', () => {
      it('dispatches import request', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: { total: 3, imported: 3, skipped: 0, failed: 0 } },
            status: 200,
          },
        });

        const body = { data: { objects: { customer: {} } }, conflictResolution: 'merge' };
        const req = { params: {}, url: '/api/meta/import', method: 'POST', body };
        await controller.metadata(req, res, body);

        expect(res._body.data.imported).toBe(3);
      });
    });

    describe('POST /api/meta/import — Dry run', () => {
      it('returns preview without saving', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: { total: 2, imported: 0, skipped: 0, failed: 0 } },
            status: 200,
          },
        });

        const body = { data: {}, dryRun: true };
        const req = { params: {}, url: '/api/meta/import', method: 'POST', body };
        await controller.metadata(req, res, body);

        expect(res._body.data.total).toBe(2);
      });
    });
  });

  // ==========================================
  // Validation
  // ==========================================

  describe('Validation', () => {
    describe('POST /api/meta/validate — Validate metadata', () => {
      it('dispatches validation for valid payload', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: { valid: true } },
            status: 200,
          },
        });

        const body = { type: 'object', data: { name: 'test', fields: {} } };
        const req = { params: {}, url: '/api/meta/validate', method: 'POST', body };
        await controller.metadata(req, res, body);

        expect(res._body.data.valid).toBe(true);
      });

      it('returns errors for invalid metadata', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
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

        const body = { type: 'object', data: {} };
        const req = { params: {}, url: '/api/meta/validate', method: 'POST', body };
        await controller.metadata(req, res, body);

        expect(res._body.data.valid).toBe(false);
        expect(res._body.data.errors).toHaveLength(1);
      });
    });
  });

  // ==========================================
  // Type Registry
  // ==========================================

  describe('Type Registry', () => {
    describe('GET /api/meta/types — List types', () => {
      it('returns all types', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
          handled: true,
          response: {
            body: { success: true, data: ['object', 'view', 'flow', 'agent'] },
            status: 200,
          },
        });

        const req = { params: {}, url: '/api/meta/types', method: 'GET' };
        await controller.metadata(req, res, undefined);

        expect(res._body.data).toContain('object');
        expect(res._body.data).toContain('agent');
      });
    });

    describe('GET /api/meta/types/object — Get type info', () => {
      it('returns type metadata', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
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

        const req = { params: {}, url: '/api/meta/types/object', method: 'GET' };
        await controller.metadata(req, res, undefined);

        expect(res._body.data.domain).toBe('data');
        expect(res._body.data.supportsOverlay).toBe(true);
      });
    });
  });

  // ==========================================
  // Dependency Tracking
  // ==========================================

  describe('Dependency Tracking', () => {
    describe('GET /api/meta/objects/account/dependencies', () => {
      it('returns dependencies', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
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

        const req = { params: {}, url: '/api/meta/objects/account/dependencies', method: 'GET' };
        await controller.metadata(req, res, undefined);

        expect(res._body.data).toHaveLength(1);
        expect(res._body.data[0].kind).toBe('reference');
      });
    });

    describe('GET /api/meta/objects/account/dependents', () => {
      it('returns dependents', async () => {
        (service.dispatcher.dispatch as any).mockResolvedValueOnce({
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

        const req = { params: {}, url: '/api/meta/objects/account/dependents', method: 'GET' };
        await controller.metadata(req, res, undefined);

        expect(res._body.data).toHaveLength(2);
      });
    });
  });

  // ==========================================
  // Error Handling
  // ==========================================

  describe('Error Handling', () => {
    it('returns 404 when metadata not found', async () => {
      (service.dispatcher.dispatch as any).mockResolvedValueOnce({ handled: false });

      const req = { params: {}, url: '/api/meta/objects/nonexistent', method: 'GET' };
      await controller.metadata(req, res, undefined);

      expect(res._status).toBe(404);
      expect(res._body.success).toBe(false);
    });

    it('returns 500 on dispatcher exception', async () => {
      (service.dispatcher.dispatch as any).mockRejectedValueOnce(new Error('Internal error'));

      const req = { params: {}, url: '/api/meta/objects', method: 'GET' };
      await controller.metadata(req, res, undefined);

      expect(res._status).toBe(500);
      expect(res._body.error.message).toBe('Internal error');
    });

    it('returns custom status code from error', async () => {
      (service.dispatcher.dispatch as any).mockRejectedValueOnce(
        Object.assign(new Error('Forbidden'), { statusCode: 403 }),
      );

      const req = { params: {}, url: '/api/meta/objects', method: 'GET' };
      await controller.metadata(req, res, undefined);

      expect(res._status).toBe(403);
    });
  });

  // ==========================================
  // Path Parsing
  // ==========================================

  describe('Path Parsing', () => {
    it('correctly extracts nested paths', async () => {
      const req = { params: {}, url: '/api/meta/objects/account/fields/name', method: 'GET' };
      await controller.metadata(req, res, undefined);

      expect(service.dispatcher.dispatch).toHaveBeenCalledWith(
        'GET',
        '/meta/objects/account/fields/name',
        undefined,
        undefined,
        { request: req },
      );
    });

    it('correctly extracts path with query string', async () => {
      const req = { params: {}, url: '/api/meta/objects?scope=platform', method: 'GET' };
      await controller.metadata(req, res, undefined);

      expect(service.dispatcher.dispatch).toHaveBeenCalledWith(
        'GET',
        '/meta/objects',
        undefined,
        undefined,
        { request: req },
      );
    });
  });
});
