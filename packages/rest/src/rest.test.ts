// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RouteManager, RouteGroupBuilder } from './route-manager';
import { RestServer } from './rest-server';
import { createRestApiPlugin } from './rest-api-plugin';
import type { RestApiPluginConfig } from './rest-api-plugin';

// ---------------------------------------------------------------------------
// Mocks & Helpers
// ---------------------------------------------------------------------------

/** Minimal IHttpServer mock */
function createMockServer() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    use: vi.fn(),
    listen: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

/** Minimal ObjectStackProtocol mock */
function createMockProtocol() {
  return {
    getDiscovery: vi.fn().mockResolvedValue({
      version: 'v0',
      endpoints: { data: '', metadata: '', ui: '', auth: '/auth' },
    }),
    getMetaTypes: vi.fn().mockResolvedValue([]),
    getMetaItems: vi.fn().mockResolvedValue([]),
    getMetaItem: vi.fn().mockResolvedValue({}),
    getMetaItemCached: undefined as any,
    saveMetaItem: undefined as any,
    getUiView: undefined as any,
    findData: vi.fn().mockResolvedValue([]),
    getData: vi.fn().mockResolvedValue({}),
    createData: vi.fn().mockResolvedValue({ id: '1' }),
    updateData: vi.fn().mockResolvedValue({}),
    deleteData: vi.fn().mockResolvedValue({ success: true }),
    batchData: undefined as any,
    createManyData: undefined as any,
    updateManyData: undefined as any,
    deleteManyData: undefined as any,
  };
}

/** Minimal PluginContext mock */
function createMockPluginContext(services: Record<string, any> = {}) {
  return {
    registerService: vi.fn(),
    getService: vi.fn((name: string) => {
      if (services[name]) return services[name];
      throw new Error(`Service '${name}' not found`);
    }),
    getServices: vi.fn(() => new Map(Object.entries(services))),
    hook: vi.fn(),
    trigger: vi.fn().mockResolvedValue(undefined),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    getKernel: vi.fn(),
  };
}

/** Dummy handler */
const noop = vi.fn();

// ---------------------------------------------------------------------------
// RouteManager
// ---------------------------------------------------------------------------

describe('RouteManager', () => {
  let server: ReturnType<typeof createMockServer>;
  let manager: RouteManager;

  beforeEach(() => {
    server = createMockServer();
    manager = new RouteManager(server as any);
  });

  // -- Registration --------------------------------------------------------

  describe('register', () => {
    it('should register a GET route and delegate to server.get', () => {
      manager.register({ method: 'GET', path: '/users', handler: noop });
      expect(server.get).toHaveBeenCalledWith('/users', noop);
      expect(manager.count()).toBe(1);
    });

    it('should register POST, PUT, PATCH, DELETE routes', () => {
      manager.register({ method: 'POST', path: '/a', handler: noop });
      manager.register({ method: 'PUT', path: '/b', handler: noop });
      manager.register({ method: 'PATCH', path: '/c', handler: noop });
      manager.register({ method: 'DELETE', path: '/d', handler: noop });

      expect(server.post).toHaveBeenCalledWith('/a', noop);
      expect(server.put).toHaveBeenCalledWith('/b', noop);
      expect(server.patch).toHaveBeenCalledWith('/c', noop);
      expect(server.delete).toHaveBeenCalledWith('/d', noop);
      expect(manager.count()).toBe(4);
    });

    it('should store metadata on the route entry', () => {
      manager.register({
        method: 'GET',
        path: '/items',
        handler: noop,
        metadata: { summary: 'List items', tags: ['items'] },
      });

      const entry = manager.get('GET', '/items');
      expect(entry).toBeDefined();
      expect(entry!.metadata?.summary).toBe('List items');
      expect(entry!.metadata?.tags).toContain('items');
    });

    it('should throw when a string handler is provided', () => {
      expect(() =>
        manager.register({ method: 'GET', path: '/x', handler: 'someHandler' }),
      ).toThrow(/String-based route handlers/);
    });
  });

  // -- registerMany --------------------------------------------------------

  describe('registerMany', () => {
    it('should register multiple routes at once', () => {
      manager.registerMany([
        { method: 'GET', path: '/a', handler: noop },
        { method: 'POST', path: '/b', handler: noop },
      ]);
      expect(manager.count()).toBe(2);
    });
  });

  // -- Lookup / query -------------------------------------------------------

  describe('get', () => {
    it('should return undefined for unregistered route', () => {
      expect(manager.get('GET', '/nothing')).toBeUndefined();
    });

    it('should return the entry for a registered route', () => {
      manager.register({ method: 'GET', path: '/users', handler: noop });
      const entry = manager.get('GET', '/users');
      expect(entry).toBeDefined();
      expect(entry!.path).toBe('/users');
    });
  });

  describe('getAll', () => {
    it('should return all registered routes', () => {
      manager.register({ method: 'GET', path: '/a', handler: noop });
      manager.register({ method: 'POST', path: '/b', handler: noop });
      expect(manager.getAll()).toHaveLength(2);
    });
  });

  describe('getByMethod', () => {
    it('should filter routes by HTTP method', () => {
      manager.register({ method: 'GET', path: '/a', handler: noop });
      manager.register({ method: 'GET', path: '/b', handler: noop });
      manager.register({ method: 'POST', path: '/c', handler: noop });

      expect(manager.getByMethod('GET')).toHaveLength(2);
      expect(manager.getByMethod('POST')).toHaveLength(1);
      expect(manager.getByMethod('DELETE')).toHaveLength(0);
    });
  });

  describe('getByPrefix', () => {
    it('should filter routes by path prefix', () => {
      manager.register({ method: 'GET', path: '/api/users', handler: noop });
      manager.register({ method: 'GET', path: '/api/items', handler: noop });
      manager.register({ method: 'GET', path: '/other', handler: noop });

      expect(manager.getByPrefix('/api')).toHaveLength(2);
    });
  });

  describe('getByTag', () => {
    it('should filter routes by metadata tag', () => {
      manager.register({
        method: 'GET', path: '/a', handler: noop,
        metadata: { tags: ['users'] },
      });
      manager.register({
        method: 'GET', path: '/b', handler: noop,
        metadata: { tags: ['items'] },
      });
      manager.register({ method: 'GET', path: '/c', handler: noop });

      expect(manager.getByTag('users')).toHaveLength(1);
      expect(manager.getByTag('missing')).toHaveLength(0);
    });
  });

  // -- Unregister -----------------------------------------------------------

  describe('unregister', () => {
    it('should remove a route from the registry', () => {
      manager.register({ method: 'GET', path: '/x', handler: noop });
      expect(manager.count()).toBe(1);

      manager.unregister('GET', '/x');
      expect(manager.count()).toBe(0);
      expect(manager.get('GET', '/x')).toBeUndefined();
    });
  });

  // -- Clear ----------------------------------------------------------------

  describe('clear', () => {
    it('should remove all routes', () => {
      manager.registerMany([
        { method: 'GET', path: '/a', handler: noop },
        { method: 'POST', path: '/b', handler: noop },
      ]);
      manager.clear();
      expect(manager.count()).toBe(0);
    });
  });

  // -- Group ----------------------------------------------------------------

  describe('group', () => {
    it('should create routes with the prefix prepended', () => {
      manager.group('/api/v1', (group) => {
        group.get('/users', noop);
        group.post('/users', noop);
        group.put('/users/:id', noop);
        group.patch('/users/:id', noop);
        group.delete('/users/:id', noop);
      });

      expect(manager.count()).toBe(5);
      expect(manager.get('GET', '/api/v1/users')).toBeDefined();
      expect(manager.get('POST', '/api/v1/users')).toBeDefined();
      expect(manager.get('PUT', '/api/v1/users/:id')).toBeDefined();
      expect(manager.get('PATCH', '/api/v1/users/:id')).toBeDefined();
      expect(manager.get('DELETE', '/api/v1/users/:id')).toBeDefined();
    });

    it('should normalize paths (strip trailing slash on prefix, ensure leading slash on path)', () => {
      manager.group('/api/', (group) => {
        group.get('items', noop);
      });
      expect(manager.get('GET', '/api/items')).toBeDefined();
    });

    it('should allow chaining on group builder methods', () => {
      manager.group('/api', (group) => {
        const result = group
          .get('/a', noop)
          .post('/b', noop);
        expect(result).toBe(group);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// RestServer
// ---------------------------------------------------------------------------

describe('RestServer', () => {
  let server: ReturnType<typeof createMockServer>;
  let protocol: ReturnType<typeof createMockProtocol>;

  beforeEach(() => {
    server = createMockServer();
    protocol = createMockProtocol();
  });

  // -- Constructor & defaults -----------------------------------------------

  describe('constructor', () => {
    it('should create a RestServer with default config', () => {
      const rest = new RestServer(server as any, protocol as any);
      expect(rest).toBeDefined();
      expect(rest.getRouteManager()).toBeInstanceOf(RouteManager);
    });

    it('should accept custom config', () => {
      const rest = new RestServer(server as any, protocol as any, {
        api: { version: 'v2', basePath: '/custom' },
      } as any);
      expect(rest).toBeDefined();
    });
  });

  // -- registerRoutes -------------------------------------------------------

  describe('registerRoutes', () => {
    it('should register discovery, metadata, UI, CRUD, and batch routes by default', () => {
      const rest = new RestServer(server as any, protocol as any);
      rest.registerRoutes();

      const routes = rest.getRoutes();
      expect(routes.length).toBeGreaterThan(0);

      // Expect at least discovery + metadata + CRUD routes
      const paths = routes.map((r) => r.path);
      // Discovery (both basePath and basePath/discovery)
      expect(paths).toContain('/api/v1');
      expect(paths).toContain('/api/v1/discovery');
      // Metadata
      expect(paths.some((p) => p.includes('/meta'))).toBe(true);
      // CRUD
      expect(paths.some((p) => p.includes('/data'))).toBe(true);
    });

    it('should use custom apiPath when specified', () => {
      const rest = new RestServer(server as any, protocol as any, {
        api: { apiPath: '/custom/path' },
      } as any);
      rest.registerRoutes();

      const paths = rest.getRoutes().map((r) => r.path);
      expect(paths.some((p) => p.startsWith('/custom/path'))).toBe(true);
    });

    it('should skip CRUD routes when enableCrud is false', () => {
      const rest = new RestServer(server as any, protocol as any, {
        api: { enableCrud: false },
      } as any);
      rest.registerRoutes();

      const tags = rest.getRoutes().flatMap((r) => r.metadata?.tags ?? []);
      expect(tags).not.toContain('crud');
    });

    it('should skip metadata routes when enableMetadata is false', () => {
      const rest = new RestServer(server as any, protocol as any, {
        api: { enableMetadata: false },
      } as any);
      rest.registerRoutes();

      const routes = rest.getRoutes();
      // Only the PUT /meta/:type/:name is always registered, but enableMetadata=false
      // skips the entire registerMetadataEndpoints call
      expect(routes.every((r) => !r.path.includes('/meta'))).toBe(true);
    });

    it('should skip discovery when enableDiscovery is false', () => {
      const rest = new RestServer(server as any, protocol as any, {
        api: { enableDiscovery: false },
      } as any);
      rest.registerRoutes();

      const routes = rest.getRoutes();
      // Neither basePath nor basePath/discovery should be registered
      const discoveryRoutes = routes.filter((r) =>
        r.metadata?.tags?.includes('discovery'),
      );
      expect(discoveryRoutes).toHaveLength(0);
    });

    it('should skip batch routes when enableBatch is false', () => {
      const rest = new RestServer(server as any, protocol as any, {
        api: { enableBatch: false },
      } as any);
      rest.registerRoutes();

      const tags = rest.getRoutes().flatMap((r) => r.metadata?.tags ?? []);
      expect(tags).not.toContain('batch');
    });

    it('should register batch endpoints when protocol implements batch methods', () => {
      protocol.batchData = vi.fn().mockResolvedValue({});
      protocol.createManyData = vi.fn().mockResolvedValue([]);
      protocol.updateManyData = vi.fn().mockResolvedValue([]);
      protocol.deleteManyData = vi.fn().mockResolvedValue([]);

      const rest = new RestServer(server as any, protocol as any);
      rest.registerRoutes();

      const batchRoutes = rest.getRoutes().filter((r) =>
        r.metadata?.tags?.includes('batch'),
      );
      expect(batchRoutes.length).toBeGreaterThan(0);
    });

    it('should register UI view endpoint when enableUi is true', () => {
      const rest = new RestServer(server as any, protocol as any);
      rest.registerRoutes();

      const uiRoutes = rest.getRoutes().filter((r) =>
        r.metadata?.tags?.includes('ui'),
      );
      expect(uiRoutes.length).toBeGreaterThan(0);
    });
  });

  // -- getRouteManager / getRoutes ------------------------------------------

  describe('getRouteManager', () => {
    it('should return the internal RouteManager instance', () => {
      const rest = new RestServer(server as any, protocol as any);
      const rm = rest.getRouteManager();
      expect(rm).toBeInstanceOf(RouteManager);
    });
  });

  describe('getRoutes', () => {
    it('should return an empty array before registerRoutes is called', () => {
      const rest = new RestServer(server as any, protocol as any);
      expect(rest.getRoutes()).toEqual([]);
    });
  });

  describe('getData handler expand/select forwarding', () => {
    function getRoute(rest: any, pathSuffix: string) {
      const routes = rest.getRoutes();
      return routes.find(
        (r: any) => r.method === 'GET' && r.path === `/api/v1/data/${pathSuffix}`,
      );
    }

    it('should pass expand and select query params to protocol.getData', async () => {
      const rest = new RestServer(server as any, protocol as any);
      rest.registerRoutes();

      const getByIdRoute = getRoute(rest, ':object/:id');
      expect(getByIdRoute).toBeDefined();

      // Simulate request with expand and select query params
      const mockReq = {
        params: { object: 'order_item', id: 'oi_123' },
        query: { expand: 'order,product', select: 'name,total' },
      };
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      protocol.getData.mockResolvedValue({
        object: 'order_item',
        id: 'oi_123',
        record: { _id: 'oi_123', name: 'Item 1' },
      });

      await getByIdRoute!.handler(mockReq, mockRes);

      expect(protocol.getData).toHaveBeenCalledWith(
        expect.objectContaining({
          object: 'order_item',
          id: 'oi_123',
          expand: 'order,product',
          select: 'name,total',
        }),
      );
    });

    it('should omit expand/select when not present in query', async () => {
      const rest = new RestServer(server as any, protocol as any);
      rest.registerRoutes();

      const getByIdRoute = getRoute(rest, ':object/:id');

      const mockReq = {
        params: { object: 'contact', id: 'c_1' },
        query: {},
      };
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      protocol.getData.mockResolvedValue({
        object: 'contact',
        id: 'c_1',
        record: { _id: 'c_1' },
      });

      await getByIdRoute!.handler(mockReq, mockRes);

      // Should NOT have expand or select keys in the call
      const callArg = protocol.getData.mock.calls[protocol.getData.mock.calls.length - 1][0];
      expect(callArg).toEqual({ object: 'contact', id: 'c_1' });
    });
  });

  describe('findData handler expand/populate forwarding', () => {
    function getListRoute(rest: any) {
      const routes = rest.getRoutes();
      return routes.find(
        (r: any) => r.method === 'GET' && r.path === '/api/v1/data/:object',
      );
    }

    it('should pass query params including expand to protocol.findData', async () => {
      const rest = new RestServer(server as any, protocol as any);
      rest.registerRoutes();

      const listRoute = getListRoute(rest);
      expect(listRoute).toBeDefined();

      const mockReq = {
        params: { object: 'order_item' },
        query: { expand: 'order,product', top: '10' },
      };
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      protocol.findData.mockResolvedValue({
        object: 'order_item',
        records: [],
        total: 0,
      });

      await listRoute!.handler(mockReq, mockRes);

      expect(protocol.findData).toHaveBeenCalledWith({
        object: 'order_item',
        query: { expand: 'order,product', top: '10' },
      });
    });

    it('should pass populate query param to protocol.findData', async () => {
      const rest = new RestServer(server as any, protocol as any);
      rest.registerRoutes();

      const listRoute = getListRoute(rest);

      const mockReq = {
        params: { object: 'task' },
        query: { populate: 'assignee,project' },
      };
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      protocol.findData.mockResolvedValue({
        object: 'task',
        records: [],
        total: 0,
      });

      await listRoute!.handler(mockReq, mockRes);

      expect(protocol.findData).toHaveBeenCalledWith({
        object: 'task',
        query: { populate: 'assignee,project' },
      });
    });
  });
});

// ---------------------------------------------------------------------------
// createRestApiPlugin
// ---------------------------------------------------------------------------

describe('createRestApiPlugin', () => {
  it('should return a plugin object with name and version', () => {
    const plugin = createRestApiPlugin();
    expect(plugin.name).toBe('com.objectstack.rest.api');
    expect(plugin.version).toBe('1.0.0');
    expect(typeof plugin.init).toBe('function');
    expect(typeof plugin.start).toBe('function');
  });

  it('should accept custom config', () => {
    const cfg: RestApiPluginConfig = {
      serverServiceName: 'my.server',
      protocolServiceName: 'my.protocol',
    };
    const plugin = createRestApiPlugin(cfg);
    expect(plugin.name).toBe('com.objectstack.rest.api');
  });

  describe('init', () => {
    it('should resolve without error', async () => {
      const plugin = createRestApiPlugin();
      const ctx = createMockPluginContext();
      await expect(plugin.init(ctx as any)).resolves.toBeUndefined();
    });
  });

  describe('start', () => {
    it('should warn and skip when http server is not found', async () => {
      const plugin = createRestApiPlugin();
      const ctx = createMockPluginContext(); // no services
      await plugin.start!(ctx as any);
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('HTTP Server'),
      );
    });

    it('should warn and skip when protocol is not found', async () => {
      const mockServer = createMockServer();
      const ctx = createMockPluginContext({ 'http.server': mockServer });
      const plugin = createRestApiPlugin();
      await plugin.start!(ctx as any);
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Protocol'),
      );
    });

    it('should register REST routes when both services are present', async () => {
      const mockServer = createMockServer();
      const mockProtocol = createMockProtocol();
      const ctx = createMockPluginContext({
        'http.server': mockServer,
        protocol: mockProtocol,
      });

      const plugin = createRestApiPlugin();
      await plugin.start!(ctx as any);

      expect(ctx.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('REST API successfully registered'),
      );
      // CRUD routes should have been mounted
      expect(mockServer.get).toHaveBeenCalled();
      expect(mockServer.post).toHaveBeenCalled();
    });

    it('should use custom service names from config', async () => {
      const mockServer = createMockServer();
      const mockProtocol = createMockProtocol();
      const ctx = createMockPluginContext({
        'my.server': mockServer,
        'my.protocol': mockProtocol,
      });

      const plugin = createRestApiPlugin({
        serverServiceName: 'my.server',
        protocolServiceName: 'my.protocol',
      });
      await plugin.start!(ctx as any);

      expect(ctx.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('REST API successfully registered'),
      );
    });

    it('should throw and log error when RestServer construction fails', async () => {
      const badServer = {}; // missing methods → will throw
      const mockProtocol = createMockProtocol();
      const ctx = createMockPluginContext({
        'http.server': badServer,
        protocol: mockProtocol,
      });

      const plugin = createRestApiPlugin();
      await expect(plugin.start!(ctx as any)).rejects.toThrow();
      expect(ctx.logger.error).toHaveBeenCalled();
    });
  });
});
