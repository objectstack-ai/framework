// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthPlugin } from './auth-plugin';
import type { PluginContext } from '@objectstack/core';

describe('AuthPlugin', () => {
  let mockContext: PluginContext;
  let authPlugin: AuthPlugin;

  /** Shared hook capture utilities for tests that need kernel:ready simulation */
  const createHookCapture = () => {
    const handlers = new Map<string, Array<(...args: any[]) => Promise<void>>>();
    const hookFn = vi.fn((name: string, handler: (...args: any[]) => Promise<void>) => {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name)!.push(handler);
    });
    const trigger = async (name: string) => {
      for (const h of handlers.get(name) || []) await h();
    };
    return { handlers, hookFn, trigger };
  };

  beforeEach(() => {
    mockContext = {
      registerService: vi.fn(),
      getService: vi.fn(),
      getServices: vi.fn(() => new Map()),
      hook: vi.fn(),
      trigger: vi.fn(),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
      getKernel: vi.fn(),
    };
  });

  describe('Plugin Metadata', () => {
    it('should have correct plugin metadata', () => {
      authPlugin = new AuthPlugin({
        secret: 'test-secret',
      });

      expect(authPlugin.name).toBe('com.objectstack.auth');
      expect(authPlugin.type).toBe('standard');
      expect(authPlugin.version).toBe('1.0.0');
      expect(authPlugin.dependencies).toEqual([]);
    });
  });

  describe('Initialization', () => {
    it('should throw error if secret is not provided', async () => {
      authPlugin = new AuthPlugin({});

      await expect(authPlugin.init(mockContext)).rejects.toThrow(
        'AuthPlugin: secret is required'
      );
    });

    it('should initialize successfully with required config', async () => {
      authPlugin = new AuthPlugin({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
      });

      await authPlugin.init(mockContext);

      expect(mockContext.logger.info).toHaveBeenCalledWith('Initializing Auth Plugin...');
      expect(mockContext.registerService).toHaveBeenCalledWith('auth', expect.anything());
      expect(mockContext.logger.info).toHaveBeenCalledWith('Auth Plugin initialized successfully');
    });

    it('should configure OAuth providers', async () => {
      authPlugin = new AuthPlugin({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
        providers: [
          {
            id: 'google',
            clientId: 'google-client-id',
            clientSecret: 'google-client-secret',
            scope: ['email', 'profile'],
          },
        ],
      });

      await authPlugin.init(mockContext);

      expect(mockContext.registerService).toHaveBeenCalled();
    });

    it('should configure plugins', async () => {
      authPlugin = new AuthPlugin({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
        plugins: {
          organization: true,
          twoFactor: true,
          passkeys: true,
          magicLink: true,
        },
      });

      await authPlugin.init(mockContext);

      expect(mockContext.registerService).toHaveBeenCalled();
    });
    it('should NOT call ctx.getService(data) during init', async () => {
      authPlugin = new AuthPlugin({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
      });

      // Make getService('data') throw to prove init does not call it
      mockContext.getService = vi.fn((name: string) => {
        if (name === 'data') throw new Error("Service 'data' is async - use await");
        return undefined;
      });

      // init should succeed without touching 'data' service
      await authPlugin.init(mockContext);

      expect(mockContext.getService).not.toHaveBeenCalledWith('data');
      expect(mockContext.registerService).toHaveBeenCalledWith('auth', expect.anything());
    });
  });

  describe('Start Phase', () => {
    let hookCapture: ReturnType<typeof createHookCapture>;

    beforeEach(async () => {
      hookCapture = createHookCapture();
      authPlugin = new AuthPlugin({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
      });
      // Capture hook registrations so we can trigger them in tests
      mockContext.hook = hookCapture.hookFn;
      await authPlugin.init(mockContext);
    });

    it('should inject data engine via setDataEngine during start', async () => {
      const mockDataEngine = { insert: vi.fn(), find: vi.fn() };
      mockContext.getService = vi.fn((name: string) => {
        if (name === 'data') return mockDataEngine;
        return undefined;
      });

      const registeredAuthManager = (mockContext.registerService as any).mock.calls.find(
        (c: any[]) => c[0] === 'auth',
      )[1];
      const setDataEngineSpy = vi.spyOn(registeredAuthManager, 'setDataEngine');

      await authPlugin.start(mockContext);

      expect(setDataEngineSpy).toHaveBeenCalledWith(mockDataEngine);
    });

    it('should fallback to kernel.getServiceAsync when sync getService throws', async () => {
      const mockDataEngine = { insert: vi.fn(), find: vi.fn() };
      mockContext.getService = vi.fn((name: string) => {
        if (name === 'data') throw new Error("Service 'data' is async - use await");
        return undefined;
      });
      mockContext.getKernel = vi.fn(() => ({
        getServiceAsync: vi.fn().mockResolvedValue(mockDataEngine),
      }));

      const registeredAuthManager = (mockContext.registerService as any).mock.calls.find(
        (c: any[]) => c[0] === 'auth',
      )[1];
      const setDataEngineSpy = vi.spyOn(registeredAuthManager, 'setDataEngine');

      await authPlugin.start(mockContext);

      expect(setDataEngineSpy).toHaveBeenCalledWith(mockDataEngine);
    });

    it('should warn when no data engine is available', async () => {
      mockContext.getService = vi.fn(() => {
        throw new Error('Service not found');
      });
      mockContext.getKernel = vi.fn(() => undefined);

      await authPlugin.start(mockContext);

      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        'No data engine service found - auth will use in-memory storage'
      );
    });

    it('should register a kernel:ready hook for route registration', async () => {
      await authPlugin.start(mockContext);

      expect(mockContext.hook).toHaveBeenCalledWith('kernel:ready', expect.any(Function));
    });

    it('should register routes with HTTP server on kernel:ready', async () => {
      const mockRawApp = {
        all: vi.fn(),
      };

      const mockHttpServer = {
        post: vi.fn(),
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        patch: vi.fn(),
        use: vi.fn(),
        getRawApp: vi.fn(() => mockRawApp),
      };

      mockContext.getService = vi.fn((name: string) => {
        if (name === 'http-server') return mockHttpServer;
        throw new Error(`Service not found: ${name}`);
      });

      await authPlugin.start(mockContext);

      // Routes should NOT be registered yet (deferred to kernel:ready)
      expect(mockRawApp.all).not.toHaveBeenCalled();

      // Simulate kernel:ready
      await hookCapture.trigger('kernel:ready');

      expect(mockContext.getService).toHaveBeenCalledWith('http-server');
      expect(mockHttpServer.getRawApp).toHaveBeenCalled();
      expect(mockRawApp.all).toHaveBeenCalledWith('/api/v1/auth/*', expect.any(Function));
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Auth routes registered')
      );
    });

    it('should log via ctx.logger when better-auth returns a 500 response', async () => {
      const mockRawApp = {
        all: vi.fn(),
      };

      const mockHttpServer = {
        post: vi.fn(),
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        patch: vi.fn(),
        use: vi.fn(),
        getRawApp: vi.fn(() => mockRawApp),
      };

      mockContext.getService = vi.fn((name: string) => {
        if (name === 'http-server') return mockHttpServer;
        throw new Error(`Service not found: ${name}`);
      });

      await authPlugin.start(mockContext);
      await hookCapture.trigger('kernel:ready');

      // Extract the registered route handler
      const routeHandler = mockRawApp.all.mock.calls[0][1];

      // Create a mock Hono context with a request that will trigger a 500 response
      const errorResponse = new Response(
        JSON.stringify({ error: 'Database connection failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );

      // Mock the authManager's handleRequest to return a 500 response
      // We access the private authManager through the registered service
      const registeredAuthManager = (mockContext.registerService as any).mock.calls[0][1];
      vi.spyOn(registeredAuthManager, 'handleRequest').mockResolvedValue(errorResponse);

      const mockHonoCtx = {
        req: {
          raw: new Request('http://localhost:3000/api/v1/auth/sign-up/email', {
            method: 'POST',
            body: JSON.stringify({ email: 'a@b.com', password: 'pass' }),
            headers: { 'Content-Type': 'application/json' },
          }),
        },
      };

      const result = await routeHandler(mockHonoCtx);

      expect(result.status).toBe(500);
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        '[AuthPlugin] better-auth returned server error',
        expect.any(Error)
      );
    });

    it('should skip route registration when disabled', async () => {
      authPlugin = new AuthPlugin({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
        registerRoutes: false,
      });

      await authPlugin.init(mockContext);
      await authPlugin.start(mockContext);

      // Should not register kernel:ready hook for routes
      expect(mockContext.hook).not.toHaveBeenCalledWith('kernel:ready', expect.any(Function));
    });

    it('should gracefully skip routes when http-server is not available', async () => {
      mockContext.getService = vi.fn(() => null);

      await authPlugin.start(mockContext);
      await hookCapture.trigger('kernel:ready');

      expect(mockContext.getService).toHaveBeenCalledWith('http-server');
      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No HTTP server available')
      );
      // Should NOT throw — auth service is still registered from init()
    });

    it('should gracefully handle http-server getService throwing', async () => {
      mockContext.getService = vi.fn(() => {
        throw new Error('Service not found: http-server');
      });

      await authPlugin.start(mockContext);
      await hookCapture.trigger('kernel:ready');

      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No HTTP server available')
      );
      // Auth service should still be registered from init()
      expect(mockContext.registerService).toHaveBeenCalledWith('auth', expect.anything());
      // Should NOT throw
    });

    it('should auto-detect baseUrl from http-server port when port differs', async () => {
      const mockRawApp = { all: vi.fn() };
      const mockHttpServer = {
        post: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn(),
        patch: vi.fn(), use: vi.fn(),
        getRawApp: vi.fn(() => mockRawApp),
        getPort: vi.fn(() => 3002),
      };

      mockContext.getService = vi.fn((name: string) => {
        if (name === 'http-server') return mockHttpServer;
        throw new Error(`Service not found: ${name}`);
      });

      // AuthPlugin configured with default port 3000, but server will be on 3002
      const registeredAuthManager = (mockContext.registerService as any).mock.calls[0][1];
      const setRuntimeSpy = vi.spyOn(registeredAuthManager, 'setRuntimeBaseUrl');

      await authPlugin.start(mockContext);
      await hookCapture.trigger('kernel:ready');

      expect(setRuntimeSpy).toHaveBeenCalledWith('http://localhost:3002');
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Auth baseUrl auto-updated to http://localhost:3002'),
      );
    });

    it('should NOT update baseUrl when port matches configured value', async () => {
      const localHookCapture = createHookCapture();
      const localPlugin = new AuthPlugin({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
      });
      mockContext.hook = localHookCapture.hookFn;
      await localPlugin.init(mockContext);

      const mockRawApp = { all: vi.fn() };
      const mockHttpServer = {
        post: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn(),
        patch: vi.fn(), use: vi.fn(),
        getRawApp: vi.fn(() => mockRawApp),
        getPort: vi.fn(() => 3000),
      };

      mockContext.getService = vi.fn((name: string) => {
        if (name === 'http-server') return mockHttpServer;
        throw new Error(`Service not found: ${name}`);
      });

      // Find the auth manager registered by localPlugin (not the one from beforeEach).
      // registerService is called twice per init: 'auth' then 'app.com.objectstack.system'.
      const authCalls = (mockContext.registerService as any).mock.calls.filter(
        (c: any[]) => c[0] === 'auth',
      );
      const registeredAuthManager = authCalls.at(-1)[1];
      const setRuntimeSpy = vi.spyOn(registeredAuthManager, 'setRuntimeBaseUrl');

      await localPlugin.start(mockContext);
      await localHookCapture.trigger('kernel:ready');

      expect(setRuntimeSpy).not.toHaveBeenCalled();
    });

    it('should auto-detect baseUrl when no baseUrl configured (uses default fallback)', async () => {
      const localHookCapture = createHookCapture();
      // No baseUrl — defaults to http://localhost:3000 internally
      const localPlugin = new AuthPlugin({
        secret: 'test-secret-at-least-32-chars-long',
      });
      mockContext.hook = localHookCapture.hookFn;
      await localPlugin.init(mockContext);

      const mockRawApp = { all: vi.fn() };
      const mockHttpServer = {
        post: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn(),
        patch: vi.fn(), use: vi.fn(),
        getRawApp: vi.fn(() => mockRawApp),
        getPort: vi.fn(() => 3002),
      };

      mockContext.getService = vi.fn((name: string) => {
        if (name === 'http-server') return mockHttpServer;
        throw new Error(`Service not found: ${name}`);
      });

      // Find the auth manager registered by localPlugin (not the one from beforeEach).
      const authCalls = (mockContext.registerService as any).mock.calls.filter(
        (c: any[]) => c[0] === 'auth',
      );
      const registeredAuthManager = authCalls.at(-1)[1];
      const setRuntimeSpy = vi.spyOn(registeredAuthManager, 'setRuntimeBaseUrl');

      await localPlugin.start(mockContext);
      await localHookCapture.trigger('kernel:ready');

      expect(setRuntimeSpy).toHaveBeenCalledWith('http://localhost:3002');
    });

    it('should throw error if auth not initialized', async () => {
      const uninitializedPlugin = new AuthPlugin({
        secret: 'test-secret',
      });

      await expect(uninitializedPlugin.start(mockContext)).rejects.toThrow(
        'Auth manager not initialized'
      );
    });
  });

  describe('Destroy Phase', () => {
    it('should cleanup resources', async () => {
      authPlugin = new AuthPlugin({
        secret: 'test-secret-at-least-32-chars-long',
      });

      await authPlugin.init(mockContext);
      await authPlugin.destroy();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Configuration Options', () => {
    it('should use custom base path', async () => {
      const { hookFn, trigger } = createHookCapture();
      mockContext.hook = hookFn;

      authPlugin = new AuthPlugin({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
        basePath: '/custom/auth',
      });

      await authPlugin.init(mockContext);

      const mockRawApp = {
        all: vi.fn(),
      };

      const mockHttpServer = {
        post: vi.fn(),
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        patch: vi.fn(),
        use: vi.fn(),
        getRawApp: vi.fn(() => mockRawApp),
      };

      mockContext.getService = vi.fn(() => mockHttpServer);

      await authPlugin.start(mockContext);

      // Trigger kernel:ready to actually register routes
      await trigger('kernel:ready');

      expect(mockRawApp.all).toHaveBeenCalledWith(
        '/custom/auth/*',
        expect.any(Function)
      );
    });

    it('should configure session options', async () => {
      authPlugin = new AuthPlugin({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
        session: {
          expiresIn: 60 * 60 * 24 * 30, // 30 days
          updateAge: 60 * 60 * 24, // 1 day
        },
      });

      await authPlugin.init(mockContext);

      expect(mockContext.registerService).toHaveBeenCalled();
    });
  });
});
