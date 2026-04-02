// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext, IHttpServer } from '@objectstack/core';
import { AuthConfig } from '@objectstack/spec/system';
import { AuthManager } from './auth-manager.js';
import {
  SysUser, SysSession, SysAccount, SysVerification,
  SysOrganization, SysMember, SysInvitation,
  SysTeam, SysTeamMember,
  SysApiKey, SysTwoFactor,
} from './objects/index.js';

/**
 * Auth Plugin Options
 * Extends AuthConfig from spec with additional runtime options
 */
export interface AuthPluginOptions extends Partial<AuthConfig> {
  /**
   * Whether to automatically register auth routes
   * @default true
   */
  registerRoutes?: boolean;
  
  /**
   * Base path for auth routes
   * @default '/api/v1/auth'
   */
  basePath?: string;
}

/**
 * Authentication Plugin
 * 
 * Provides authentication and identity services for ObjectStack applications.
 * 
 * **Dual-Mode Operation:**
 * - **Server mode** (HonoServerPlugin active): Registers HTTP routes at basePath,
 *   forwarding all auth requests to better-auth's universal handler.
 * - **MSW/Mock mode** (no HTTP server): Gracefully skips route registration but
 *   still registers the `auth` service, allowing HttpDispatcher.handleAuth() to
 *   simulate auth flows (sign-up, sign-in, etc.) for development and testing.
 * 
 * Features:
 * - Session management
 * - User registration/login
 * - OAuth providers (Google, GitHub, etc.)
 * - Organization/team support
 * - 2FA, passkeys, magic links
 * 
 * This plugin registers:
 * - `auth` service (auth manager instance) — always
 * - `app.com.objectstack.system` service (system object definitions) — always
 * - HTTP routes for authentication endpoints — only when HTTP server is available
 * 
 * Integrates with better-auth library to provide comprehensive
 * authentication capabilities including email/password, OAuth, 2FA,
 * magic links, passkeys, and organization support.
 */
export class AuthPlugin implements Plugin {
  name = 'com.objectstack.auth';
  type = 'standard';
  version = '1.0.0';
  dependencies: string[] = ['com.objectstack.engine.objectql']; // manifest service required
  
  private options: AuthPluginOptions;
  private authManager: AuthManager | null = null;

  constructor(options: AuthPluginOptions = {}) {
    this.options = {
      registerRoutes: true,
      basePath: '/api/v1/auth',
      ...options
    };
  }

  async init(ctx: PluginContext): Promise<void> {
    ctx.logger.info('Initializing Auth Plugin...');

    // Validate required configuration
    if (!this.options.secret) {
      throw new Error('AuthPlugin: secret is required');
    }

    // Get data engine service for database operations
    const dataEngine = ctx.getService<any>('data');
    if (!dataEngine) {
      ctx.logger.warn('No data engine service found - auth will use in-memory storage');
    }

    // Initialize auth manager with data engine
    this.authManager = new AuthManager({
      ...this.options,
      dataEngine,
    });

    // Register auth service
    ctx.registerService('auth', this.authManager);

    // Register system objects via the manifest service.
    ctx.getService<{ register(m: any): void }>('manifest').register({
      id: 'com.objectstack.system',
      name: 'System',
      version: '1.0.0',
      type: 'plugin',
      namespace: 'sys',
      objects: [
        SysUser, SysSession, SysAccount, SysVerification,
        SysOrganization, SysMember, SysInvitation,
        SysTeam, SysTeamMember,
        SysApiKey, SysTwoFactor,
      ],
    });

    // Contribute navigation items to the Setup App (if SetupPlugin is loaded).
    // Uses try/catch so AuthPlugin works independently of SetupPlugin.
    try {
      const setupNav = ctx.getService<{ contribute(c: any): void }>('setupNav');
      if (setupNav) {
        setupNav.contribute({
          areaId: 'area_administration',
          items: [
            { id: 'nav_users', type: 'object', label: 'Users', objectName: 'user', icon: 'users', order: 10 },
            { id: 'nav_organizations', type: 'object', label: 'Organizations', objectName: 'organization', icon: 'building-2', order: 20 },
            { id: 'nav_teams', type: 'object', label: 'Teams', objectName: 'team', icon: 'users-round', order: 30 },
            { id: 'nav_api_keys', type: 'object', label: 'API Keys', objectName: 'api_key', icon: 'key', order: 40 },
            { id: 'nav_sessions', type: 'object', label: 'Sessions', objectName: 'session', icon: 'monitor', order: 50 },
          ],
        });
        ctx.logger.info('Auth navigation items contributed to Setup App');
      }
    } catch {
      // SetupPlugin not loaded — skip silently
    }

    ctx.logger.info('Auth Plugin initialized successfully');
  }

  async start(ctx: PluginContext): Promise<void> {
    ctx.logger.info('Starting Auth Plugin...');

    if (!this.authManager) {
      throw new Error('Auth manager not initialized');
    }

    // Defer HTTP route registration to kernel:ready hook.
    // This ensures all plugins (including HonoServerPlugin) have completed
    // their init and start phases before we attempt to look up the
    // http-server service — making AuthPlugin resilient to plugin
    // loading order.
    if (this.options.registerRoutes) {
      ctx.hook('kernel:ready', async () => {
        let httpServer: IHttpServer | null = null;
        try {
          httpServer = ctx.getService<IHttpServer>('http-server');
        } catch {
          // Service not found — expected in MSW/mock mode
        }

        if (httpServer) {
          // Auto-detect the actual server URL when no explicit baseUrl was
          // configured, or when the configured baseUrl uses a different port
          // than the running server (e.g. port 3000 configured but 3002 bound).
          // getPort() is optional on IHttpServer; duck-type check for it.
          const serverWithPort = httpServer as IHttpServer & { getPort?: () => number };
          if (this.authManager && typeof serverWithPort.getPort === 'function') {
            const actualPort = serverWithPort.getPort();
            if (actualPort) {
              const configuredUrl = this.options.baseUrl || 'http://localhost:3000';
              const configuredOrigin = new URL(configuredUrl).origin;
              const actualUrl = `http://localhost:${actualPort}`;

              if (configuredOrigin !== actualUrl) {
                this.authManager.setRuntimeBaseUrl(actualUrl);
                ctx.logger.info(
                  `Auth baseUrl auto-updated to ${actualUrl} (configured: ${configuredUrl})`,
                );
              }
            }
          }

          // Route registration errors should propagate (server misconfiguration)
          this.registerAuthRoutes(httpServer, ctx);
          ctx.logger.info(`Auth routes registered at ${this.options.basePath}`);
        } else {
          ctx.logger.warn(
            'No HTTP server available — auth routes not registered. ' +
            'Auth service is still available for MSW/mock environments via HttpDispatcher.'
          );
        }
      });
    }

    // Register auth middleware on ObjectQL engine (if available)
    try {
      const ql = ctx.getService<any>('objectql');
      if (ql && typeof ql.registerMiddleware === 'function') {
        ql.registerMiddleware(async (opCtx: any, next: () => Promise<void>) => {
          // If context already has userId or isSystem, skip auth resolution
          if (opCtx.context?.userId || opCtx.context?.isSystem) {
            return next();
          }
          // Future: resolve session from AsyncLocalStorage or request context
          await next();
        });
        ctx.logger.info('Auth middleware registered on ObjectQL engine');
      }
    } catch (_e) {
      ctx.logger.debug('ObjectQL engine not available, skipping auth middleware registration');
    }

    ctx.logger.info('Auth Plugin started successfully');
  }

  async destroy(): Promise<void> {
    // Cleanup if needed
    this.authManager = null;
  }

  /**
   * Register authentication routes with HTTP server
   * 
   * Uses better-auth's universal handler for all authentication requests.
   * This forwards all requests under basePath to better-auth, which handles:
   * - Email/password authentication
   * - OAuth providers (Google, GitHub, etc.)
   * - Session management
   * - Password reset
   * - Email verification
   * - 2FA, passkeys, magic links (if enabled)
   */
  private registerAuthRoutes(httpServer: IHttpServer, ctx: PluginContext): void {
    if (!this.authManager) return;

    const basePath = this.options.basePath || '/api/v1/auth';

    // Get raw Hono app to use native wildcard routing
    // Type assertion is safe here because we explicitly require Hono server as a dependency
    if (!('getRawApp' in httpServer) || typeof (httpServer as any).getRawApp !== 'function') {
      ctx.logger.error('HTTP server does not support getRawApp() - wildcard routing requires Hono server');
      throw new Error(
        'AuthPlugin requires HonoServerPlugin for wildcard routing support. ' +
        'Please ensure HonoServerPlugin is loaded before AuthPlugin.'
      );
    }

    const rawApp = (httpServer as any).getRawApp();

    // Register wildcard route to forward all auth requests to better-auth.
    // better-auth is configured with basePath matching our route prefix, so we
    // forward the original request directly — no path rewriting needed.
    rawApp.all(`${basePath}/*`, async (c: any) => {
      try {
        // Forward the original request to better-auth handler
        const response = await this.authManager!.handleRequest(c.req.raw);

        // better-auth catches internal errors and returns error Responses
        // without throwing, so the catch block below would never trigger.
        // We proactively log server errors here for observability.
        if (response.status >= 500) {
          try {
            const body = await response.clone().text();
            ctx.logger.error('[AuthPlugin] better-auth returned server error', new Error(`HTTP ${response.status}: ${body}`));
          } catch {
            ctx.logger.error('[AuthPlugin] better-auth returned server error', new Error(`HTTP ${response.status}: (unable to read body)`));
          }
        }
        
        return response;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        ctx.logger.error('Auth request error:', err);
        
        // Return error response
        return new Response(
          JSON.stringify({
            success: false,
            error: err.message,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    });

    ctx.logger.info(`Auth routes registered: All requests under ${basePath}/* forwarded to better-auth`);
  }
}



