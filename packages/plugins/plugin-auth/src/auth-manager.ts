// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { betterAuth } from 'better-auth';
import type { Auth, BetterAuthOptions } from 'better-auth';
import type { AuthConfig } from '@objectstack/spec/system';
import type { IDataEngine } from '@objectstack/core';
import { createObjectQLAdapter } from './objectql-adapter.js';

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
      
      // Database adapter configuration
      // For now, we configure a basic setup that will be enhanced
      // when database URL is provided and drizzle-orm is available
      database: this.createDatabaseConfig(),
      
      // Email configuration
      emailAndPassword: {
        enabled: true,
      },
      
      // Session configuration
      session: {
        expiresIn: this.config.session?.expiresIn || 60 * 60 * 24 * 7, // 7 days default
        updateAge: this.config.session?.updateAge || 60 * 60 * 24, // 1 day default
      },
    };

    return betterAuth(betterAuthConfig);
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
    // Use ObjectQL adapter if dataEngine is provided
    if (this.config.dataEngine) {
      const adapter = createObjectQLAdapter(this.config.dataEngine);
      // Return a DBAdapterInstance factory function
      return (_options: any) => ({
        id: 'objectql',
        ...adapter,
        transaction: async <R>(cb: (trx: any) => Promise<R>): Promise<R> => cb(adapter),
      });
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
