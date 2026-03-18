// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { betterAuth } from 'better-auth';
import type { Auth, BetterAuthOptions } from 'better-auth';
import { organization } from 'better-auth/plugins/organization';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { magicLink } from 'better-auth/plugins/magic-link';
import type { AuthConfig } from '@objectstack/spec/system';
import type { IDataEngine } from '@objectstack/core';
import { createObjectQLAdapterFactory } from './objectql-adapter.js';
import {
  AUTH_USER_CONFIG,
  AUTH_SESSION_CONFIG,
  AUTH_ACCOUNT_CONFIG,
  AUTH_VERIFICATION_CONFIG,
  buildOrganizationPluginSchema,
  buildTwoFactorPluginSchema,
} from './auth-schema-config.js';

/**
 * Extended options for AuthManager
 */
export interface AuthManagerOptions extends Partial<AuthConfig> {
  /**
   * Better-Auth instance (for advanced use cases)
   * If not provided, one will be created from config
   */
  authInstance?: Auth<any>;

  /**
   * ObjectQL Data Engine instance
   * Required for database operations using ObjectQL instead of third-party ORMs
   */
  dataEngine?: IDataEngine;

  /**
   * Base path for auth routes
   * Forwarded to better-auth's basePath option so it can match incoming
   * request URLs without manual path rewriting.
   * @default '/api/v1/auth'
   */
  basePath?: string;
}

/**
 * Authentication Manager
 *
 * Wraps better-auth and provides authentication services for ObjectStack.
 * Supports multiple authentication methods:
 * - Email/password
 * - OAuth providers (Google, GitHub, etc.)
 * - Magic links
 * - Two-factor authentication
 * - Passkeys
 * - Organization/teams
 */
export class AuthManager {
  private auth: Auth<any> | null = null;
  private config: AuthManagerOptions;

  constructor(config: AuthManagerOptions) {
    this.config = config;

    // Use provided auth instance
    if (config.authInstance) {
      this.auth = config.authInstance;
    }
    // Don't create auth instance automatically to avoid database initialization errors
    // It will be created lazily when needed
  }

  /**
   * Get or create the better-auth instance (lazy initialization)
   */
  private getOrCreateAuth(): Auth<any> {
    if (!this.auth) {
      this.auth = this.createAuthInstance();
    }
    return this.auth;
  }

  /**
   * Create a better-auth instance from configuration
   */
  private createAuthInstance(): Auth<any> {
    const betterAuthConfig: BetterAuthOptions = {
      // Base configuration
      secret: this.config.secret || this.generateSecret(),
      baseURL: this.config.baseUrl || 'http://localhost:3000',
      basePath: this.config.basePath || '/api/v1/auth',

      // Database adapter configuration
      database: this.createDatabaseConfig(),

      // Model/field mapping: camelCase (better-auth) → snake_case (ObjectStack)
      // These declarations tell better-auth the actual table/column names used
      // by ObjectStack's protocol layer, enabling automatic transformation via
      // createAdapterFactory.
      user: {
        ...AUTH_USER_CONFIG,
      },
      account: {
        ...AUTH_ACCOUNT_CONFIG,
      },
      verification: {
        ...AUTH_VERIFICATION_CONFIG,
      },

      // Social / OAuth providers
      ...(this.config.socialProviders ? { socialProviders: this.config.socialProviders as any } : {}),

      // Email and password configuration
      emailAndPassword: {
        enabled: this.config.emailAndPassword?.enabled ?? true,
        ...(this.config.emailAndPassword?.disableSignUp != null
          ? { disableSignUp: this.config.emailAndPassword.disableSignUp } : {}),
        ...(this.config.emailAndPassword?.requireEmailVerification != null
          ? { requireEmailVerification: this.config.emailAndPassword.requireEmailVerification } : {}),
        ...(this.config.emailAndPassword?.minPasswordLength != null
          ? { minPasswordLength: this.config.emailAndPassword.minPasswordLength } : {}),
        ...(this.config.emailAndPassword?.maxPasswordLength != null
          ? { maxPasswordLength: this.config.emailAndPassword.maxPasswordLength } : {}),
        ...(this.config.emailAndPassword?.resetPasswordTokenExpiresIn != null
          ? { resetPasswordTokenExpiresIn: this.config.emailAndPassword.resetPasswordTokenExpiresIn } : {}),
        ...(this.config.emailAndPassword?.autoSignIn != null
          ? { autoSignIn: this.config.emailAndPassword.autoSignIn } : {}),
        ...(this.config.emailAndPassword?.revokeSessionsOnPasswordReset != null
          ? { revokeSessionsOnPasswordReset: this.config.emailAndPassword.revokeSessionsOnPasswordReset } : {}),
      },

      // Email verification
      ...(this.config.emailVerification ? {
        emailVerification: {
          ...(this.config.emailVerification.sendOnSignUp != null
            ? { sendOnSignUp: this.config.emailVerification.sendOnSignUp } : {}),
          ...(this.config.emailVerification.sendOnSignIn != null
            ? { sendOnSignIn: this.config.emailVerification.sendOnSignIn } : {}),
          ...(this.config.emailVerification.autoSignInAfterVerification != null
            ? { autoSignInAfterVerification: this.config.emailVerification.autoSignInAfterVerification } : {}),
          ...(this.config.emailVerification.expiresIn != null
            ? { expiresIn: this.config.emailVerification.expiresIn } : {}),
        },
      } : {}),

      // Session configuration
      session: {
        ...AUTH_SESSION_CONFIG,
        expiresIn: this.config.session?.expiresIn || 60 * 60 * 24 * 7, // 7 days default
        updateAge: this.config.session?.updateAge || 60 * 60 * 24, // 1 day default
      },

      // better-auth plugins — registered based on AuthPluginConfig flags
      plugins: this.buildPluginList(),

      // Trusted origins for CSRF protection (supports wildcards like "https://*.example.com")
      ...(this.config.trustedOrigins?.length ? { trustedOrigins: this.config.trustedOrigins } : {}),

      // Advanced options (cross-subdomain cookies, secure cookies, CSRF, etc.)
      ...(this.config.advanced ? {
        advanced: {
          ...(this.config.advanced.crossSubDomainCookies
            ? { crossSubDomainCookies: this.config.advanced.crossSubDomainCookies } : {}),
          ...(this.config.advanced.useSecureCookies != null
            ? { useSecureCookies: this.config.advanced.useSecureCookies } : {}),
          ...(this.config.advanced.disableCSRFCheck != null
            ? { disableCSRFCheck: this.config.advanced.disableCSRFCheck } : {}),
          ...(this.config.advanced.cookiePrefix != null
            ? { cookiePrefix: this.config.advanced.cookiePrefix } : {}),
        },
      } : {}),
    };

    return betterAuth(betterAuthConfig);
  }

  /**
   * Build the list of better-auth plugins based on AuthPluginConfig flags.
   *
   * Each plugin that introduces its own database tables is configured with
   * a `schema` option containing the appropriate snake_case field mappings,
   * so that `createAdapterFactory` transforms them automatically.
   */
  private buildPluginList(): any[] {
    const pluginConfig = this.config.plugins;
    const plugins: any[] = [];

    if (pluginConfig?.organization) {
      plugins.push(organization({
        schema: buildOrganizationPluginSchema(),
      }));
    }

    if (pluginConfig?.twoFactor) {
      plugins.push(twoFactor({
        schema: buildTwoFactorPluginSchema(),
      }));
    }

    if (pluginConfig?.magicLink) {
      // magic-link reuses the `verification` table — no extra schema mapping needed.
      // The sendMagicLink callback must be provided by the application at a higher level.
      // Here we provide a no-op default that logs a warning; real applications should
      // override this via AuthManagerOptions or a config extension point.
      plugins.push(magicLink({
        sendMagicLink: async ({ email, url }) => {
          console.warn(
            `[AuthManager] Magic-link requested for ${email} but no sendMagicLink handler configured. URL: ${url}`,
          );
        },
      }));
    }

    return plugins;
  }

  /**
   * Create database configuration using ObjectQL adapter
   *
   * better-auth resolves the `database` option as follows:
   * - `undefined`            → in-memory adapter
   * - `typeof fn === "function"` → treated as `DBAdapterInstance`, called with `(options)`
   * - otherwise              → forwarded to Kysely adapter factory (pool/dialect)
   *
   * A raw `CustomAdapter` object would fall into the third branch and fail
   * silently.  We therefore wrap the ObjectQL adapter in a factory function
   * so it is correctly recognised as a `DBAdapterInstance`.
   */
  private createDatabaseConfig(): any {
    // Use ObjectQL adapter factory if dataEngine is provided
    if (this.config.dataEngine) {
      // createObjectQLAdapterFactory returns an AdapterFactory
      // (options => DBAdapter) which better-auth invokes via getBaseAdapter().
      // The factory is created by better-auth's createAdapterFactory and
      // automatically applies modelName/fields transformations declared in
      // the betterAuth config above.
      return createObjectQLAdapterFactory(this.config.dataEngine);
    }

    // Fallback warning if no dataEngine is provided
    console.warn(
      '⚠️  WARNING: No dataEngine provided to AuthManager! ' +
      'Using in-memory storage. This is NOT suitable for production. ' +
      'Please provide a dataEngine instance (e.g., ObjectQL) in AuthManagerOptions.'
    );

    // Return a minimal in-memory configuration as fallback
    // This allows the system to work in development/testing without a real database
    return undefined; // better-auth will use its default in-memory adapter
  }

  /**
   * Generate a secure secret if not provided
   */
  private generateSecret(): string {
    const envSecret = process.env.AUTH_SECRET;

    if (!envSecret) {
      // In production, a secret MUST be provided
      // For development/testing, we'll use a fallback but warn about it
      const fallbackSecret = 'dev-secret-' + Date.now();

      console.warn(
        '⚠️  WARNING: No AUTH_SECRET environment variable set! ' +
        'Using a temporary development secret. ' +
        'This is NOT secure for production use. ' +
        'Please set AUTH_SECRET in your environment variables.'
      );

      return fallbackSecret;
    }

    return envSecret;
  }

  /**
   * Update the base URL at runtime.
   *
   * This **must** be called before the first request triggers lazy
   * initialisation of the better-auth instance — typically from a
   * `kernel:ready` hook where the actual server port is known.
   *
   * If the auth instance has already been created this is a no-op and
   * a warning is emitted.
   */
  setRuntimeBaseUrl(url: string): void {
    if (this.auth) {
      console.warn(
        '[AuthManager] setRuntimeBaseUrl() called after the auth instance was already created — ignoring. ' +
        'Ensure this method is called before the first request.',
      );
      return;
    }
    this.config = { ...this.config, baseUrl: url };
  }

  /**
   * Get the underlying better-auth instance
   * Useful for advanced use cases
   */
  getAuthInstance(): Auth<any> {
    return this.getOrCreateAuth();
  }

  /**
   * Handle an authentication request
   * Forwards the request directly to better-auth's universal handler
   *
   * better-auth catches internal errors (database / adapter / ORM) and
   * returns a 500 Response instead of throwing.  We therefore inspect the
   * response status and log server errors so they are not silently swallowed.
   *
   * @param request - Web standard Request object
   * @returns Web standard Response object
   */
  async handleRequest(request: Request): Promise<Response> {
    const auth = this.getOrCreateAuth();
    const response = await auth.handler(request);

    if (response.status >= 500) {
      try {
        const body = await response.clone().text();
        console.error('[AuthManager] better-auth returned error:', response.status, body);
      } catch {
        console.error('[AuthManager] better-auth returned error:', response.status, '(unable to read body)');
      }
    }

    return response;
  }

  /**
   * Get the better-auth API for programmatic access
   * Use this for server-side operations (e.g., creating users, checking sessions)
   */
  get api() {
    return this.getOrCreateAuth().api;
  }
}
