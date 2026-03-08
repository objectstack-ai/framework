// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthPlugin } from './auth-plugin';
import type { PluginContext } from '@objectstack/core';

describe('AuthPlugin', () => {
  let mockContext: PluginContext;
  let authPlugin: AuthPlugin;

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
  });

  describe('Start Phase', () => {
    beforeEach(async () => {
      authPlugin = new AuthPlugin({
        secret: 'test-secret-at-least-32-chars-long',
        baseUrl: 'http://localhost:3000',
      });
      await authPlugin.init(mockContext);
    });

    it('should register routes with HTTP server when enabled', async () => {
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

      expect(mockContext.getService).not.toHaveBeenCalledWith('http-server');
    });

    it('should gracefully skip routes when http-server is not available', async () => {
      mockContext.getService = vi.fn(() => null);

      await authPlugin.start(mockContext);

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

      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No HTTP server available')
      );
      // Auth service should still be registered from init()
      expect(mockContext.registerService).toHaveBeenCalledWith('auth', expect.anything());
      // Should NOT throw
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
