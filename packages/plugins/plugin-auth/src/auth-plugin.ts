// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext, IHttpServer } from '@objectstack/core';
import { AuthConfig } from '@objectstack/spec/system';
import {
  SETUP_APP,
  SystemOverviewDashboard,
  SecurityOverviewDashboard,
  UsersView,
  OrganizationsView,
  RolesView,
  SessionsView,
  AuditLogsView,
  PackageInstallationsView,
} from '@objectstack/platform-objects/apps';
import { AuthManager } from './auth-manager.js';
import {
  authIdentityObjects,
  authPluginManifestHeader,
} from './manifest.js';

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

    ctx.getService<{ register(m: any): void }>('manifest').register({
      ...authPluginManifestHeader,
      objects: authIdentityObjects,
      // The platform Setup App is a static metadata artifact (lives in
      // @objectstack/platform-objects/apps). plugin-auth is the natural
      // owner of its registration since it loads first among the trio
      // (auth + security + audit) that supplies the underlying objects.
      apps: [SETUP_APP],
      // Curated list views and dashboards consumed by the Setup App's
      // navigation entries. The manifest service does NOT auto-discover
      // these from the app definition — they must be registered as
      // explicit top-level arrays per ObjectStackDefinitionSchema.
      views: [
        UsersView,
        OrganizationsView,
        RolesView,
        SessionsView,
        AuditLogsView,
        PackageInstallationsView,
      ],
      dashboards: [SystemOverviewDashboard, SecurityOverviewDashboard],
    });

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

              // Only auto-correct the port when the configured URL is already a
              // localhost URL (development mode). In production (Vercel/cloud) the
              // configured baseUrl is the real public hostname — never overwrite it
              // with a localhost URL, which would break OAuth callback URLs.
              const configuredIsLocalhost = configuredOrigin.startsWith('http://localhost');
              if (configuredIsLocalhost && configuredOrigin !== actualUrl) {
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

    // Register /config before the wildcard so it takes precedence.
    // better-auth has no /config endpoint, so without this explicit route
    // the wildcard below forwards the request and better-auth returns 404.
    rawApp.get(`${basePath}/config`, (c: any) => {
      try {
        const config = this.authManager!.getPublicConfig();
        return c.json({ success: true, data: config });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        return c.json({ success: false, error: { code: 'auth_config_error', message: err.message } }, 500);
      }
    });

    // Bootstrap status — does an owner exist yet? Used by the Account SPA's
    // root route to decide between rendering /login (normal flow) and
    // /setup (first-run owner creation). Public, unauthenticated; only
    // returns a boolean so it can be polled before the user has any
    // credentials.
    rawApp.get(`${basePath}/bootstrap-status`, async (c: any) => {
      try {
        const dataEngine = this.authManager!.getDataEngine();
        if (!dataEngine) {
          // No data engine wired (e.g. MSW/mock mode) — assume bootstrapped
          // so the SPA falls through to its normal login flow.
          return c.json({ hasOwner: true });
        }
        const count = await dataEngine.count('sys_user', {});
        return c.json({ hasOwner: (count ?? 0) > 0 });
      } catch (error) {
        ctx.logger.warn('[AuthPlugin] bootstrap-status check failed; assuming bootstrapped', error as Error);
        return c.json({ hasOwner: true });
      }
    });

    // Device Authorization Grant (RFC 8628) endpoints — `/device/code`,
    // `/device/token`, `/device/approve`, `/device/deny`, `/device` — are
    // provided by better-auth's `device-authorization` plugin and reach
    // the wildcard handler below. Enable via
    // `AuthPluginConfig.deviceAuthorization`.

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

    // OIDC / OAuth 2.0 Authorization Server Metadata (RFC 8414) and
    // OpenID Connect Discovery 1.0 require the well-known documents to be
    // served from the **root** of the issuer URL — not under our auth
    // basePath. `@better-auth/oauth-provider` ships dedicated helpers for
    // this case (`oauthProviderAuthServerMetadata` /
    // `oauthProviderOpenIdConfigMetadata`) which we mount here so external
    // OIDC clients can discover the IdP at the canonical paths.
    if (this.options.plugins?.oidcProvider) {
      void this.registerOidcDiscoveryRoutes(rawApp, ctx).catch((error) => {
        ctx.logger.error('Failed to register OIDC discovery routes', error as Error);
      });
    }

    ctx.logger.info(`Auth routes registered: All requests under ${basePath}/* forwarded to better-auth`);
  }

  /**
   * Mount the OIDC / OAuth 2.0 well-known discovery documents at the root
   * URL. Required by RFC 8414 §3 and OpenID Connect Discovery 1.0 §4 — the
   * documents must live at `/.well-known/{oauth-authorization-server,openid-configuration}`
   * relative to the issuer, not under the auth basePath.
   */
  private async registerOidcDiscoveryRoutes(rawApp: any, ctx: PluginContext): Promise<void> {
    const auth = await this.authManager!.getAuthInstance();
    const { oauthProviderAuthServerMetadata, oauthProviderOpenIdConfigMetadata } = await import(
      '@better-auth/oauth-provider'
    );

    const authServerHandler = oauthProviderAuthServerMetadata(auth as any);
    const openidConfigHandler = oauthProviderOpenIdConfigMetadata(auth as any);

    rawApp.get('/.well-known/oauth-authorization-server', (c: any) => authServerHandler(c.req.raw));
    rawApp.get('/.well-known/openid-configuration', (c: any) => openidConfigHandler(c.req.raw));

    ctx.logger.info(
      'OIDC discovery endpoints mounted at /.well-known/{oauth-authorization-server,openid-configuration}',
    );
  }
}


