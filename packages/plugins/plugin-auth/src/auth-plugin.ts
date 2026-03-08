// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext, IHttpServer } from '@objectstack/core';
import { AuthConfig } from '@objectstack/spec/system';
import { AuthManager } from './auth-manager.js';

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
  dependencies: string[] = []; // HTTP server is optional; routes are registered only when available
  
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
    
    ctx.logger.info('Auth Plugin initialized successfully');
  }

  async start(ctx: PluginContext): Promise<void> {
    ctx.logger.info('Starting Auth Plugin...');

    if (!this.authManager) {
      throw new Error('Auth manager not initialized');
    }

    // Register HTTP routes if enabled and HTTP server is available
    if (this.options.registerRoutes) {
      let httpServer: IHttpServer | null = null;
      try {
        httpServer = ctx.getService<IHttpServer>('http-server');
      } catch {
        // Service not found — expected in MSW/mock mode
      }

      if (httpServer) {
        // Route registration errors should propagate (server misconfiguration)
        this.registerAuthRoutes(httpServer, ctx);
        ctx.logger.info(`Auth routes registered at ${this.options.basePath}`);
      } else {
        ctx.logger.warn(
          'No HTTP server available — auth routes not registered. ' +
          'Auth service is still available for MSW/mock environments via HttpDispatcher.'
        );
      }
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

    // Register wildcard route to forward all auth requests to better-auth
    // Better-auth expects requests at its baseURL, so we need to preserve the full path
    rawApp.all(`${basePath}/*`, async (c: any) => {
      try {
        // Get the Web standard Request from Hono context
        const request = c.req.raw as Request;
        
        // Create a new Request with the path rewritten to match better-auth's expectations
        // Better-auth expects paths like /sign-in/email, /sign-up/email, etc.
        // We need to strip our basePath prefix
        const url = new URL(request.url);
        const authPath = url.pathname.replace(basePath, '');
        const rewrittenUrl = new URL(authPath || '/', url.origin);
        rewrittenUrl.search = url.search; // Preserve query params
        
        const rewrittenRequest = new Request(rewrittenUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          duplex: 'half' as any, // Required for Request with body
        });

        // Forward to better-auth handler
        const response = await this.authManager!.handleRequest(rewrittenRequest);

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



