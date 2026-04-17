// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Turso Platform API Client
 *
 * Interacts with the Turso Platform API to manage databases programmatically.
 * API Documentation: https://docs.turso.tech/api-reference/platform
 *
 * Features:
 * - Create databases with regional placement
 * - Generate database-specific auth tokens
 * - Manage database lifecycle (suspend, delete, restore)
 * - Create database groups for shared configuration
 */

import type { TenantDatabase } from '@objectstack/spec/cloud';

/**
 * Turso Platform API Configuration
 */
export interface TursoPlatformConfig {
  /**
   * Turso Platform API token
   * Generate at: https://turso.tech/app/settings/tokens
   */
  apiToken: string;

  /**
   * Organization name (slug)
   */
  organization: string;

  /**
   * API base URL
   * Default: https://api.turso.tech
   */
  apiBaseUrl?: string;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Database creation request
 */
export interface CreateDatabaseRequest {
  /**
   * Database name (must be unique within organization)
   * For multi-tenant: use UUID
   */
  name: string;

  /**
   * Database group name (optional)
   * Groups share configuration like location and schema
   */
  group?: string;

  /**
   * Seed data from an existing database (optional)
   */
  seed?: {
    /**
     * Type of seed operation
     */
    type: 'database' | 'dump';

    /**
     * Source database name (for type: 'database')
     */
    name?: string;

    /**
     * Timestamp to seed from (for type: 'database')
     */
    timestamp?: string;

    /**
     * URL to SQL dump file (for type: 'dump')
     */
    url?: string;
  };

  /**
   * Enable block reads (optional)
   */
  is_schema?: boolean;
}

/**
 * Database creation response
 */
export interface CreateDatabaseResponse {
  database: {
    Name: string;
    DbId: string;
    Hostname: string;
    IsSchema: boolean;
    block_reads: boolean;
    block_writes: boolean;
    allow_attach: boolean;
    regions: string[];
    primaryRegion: string;
    type: string;
    version: string;
    group: string;
    sleeping: boolean;
  };
}

/**
 * Create database token request
 */
export interface CreateTokenRequest {
  /**
   * Token permissions
   */
  permissions?: {
    read_attach?: {
      databases: string[];
    };
  };

  /**
   * Token authorization level
   * - 'full-access': Read and write access
   * - 'read-only': Read-only access
   */
  authorization?: 'full-access' | 'read-only';

  /**
   * Token expiration time (optional)
   * Format: duration string like '1h', '7d', '30d'
   */
  expiration?: string;
}

/**
 * Create database token response
 */
export interface CreateTokenResponse {
  jwt: string;
}

/**
 * Turso Platform API Client
 */
export class TursoPlatformClient {
  private config: Required<TursoPlatformConfig>;

  constructor(config: TursoPlatformConfig) {
    this.config = {
      apiToken: config.apiToken,
      organization: config.organization,
      apiBaseUrl: config.apiBaseUrl || 'https://api.turso.tech',
      timeout: config.timeout || 30000,
    };
  }

  /**
   * Create a new database
   */
  async createDatabase(request: CreateDatabaseRequest): Promise<CreateDatabaseResponse> {
    const url = `${this.config.apiBaseUrl}/v1/organizations/${this.config.organization}/databases`;

    const response = await this.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    return response as CreateDatabaseResponse;
  }

  /**
   * Create a database-specific auth token
   */
  async createDatabaseToken(
    databaseName: string,
    request: CreateTokenRequest = {},
  ): Promise<CreateTokenResponse> {
    const url = `${this.config.apiBaseUrl}/v1/organizations/${this.config.organization}/databases/${databaseName}/auth/tokens`;

    // Default to full-access if not specified
    const body = {
      authorization: request.authorization || 'full-access',
      ...request,
    };

    const response = await this.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return response as CreateTokenResponse;
  }

  /**
   * Delete a database
   */
  async deleteDatabase(databaseName: string): Promise<void> {
    const url = `${this.config.apiBaseUrl}/v1/organizations/${this.config.organization}/databases/${databaseName}`;

    await this.fetch(url, {
      method: 'DELETE',
    });
  }

  /**
   * Get database information
   */
  async getDatabase(databaseName: string): Promise<CreateDatabaseResponse['database']> {
    const url = `${this.config.apiBaseUrl}/v1/organizations/${this.config.organization}/databases/${databaseName}`;

    const response = await this.fetch(url, {
      method: 'GET',
    });

    return (response as any).database;
  }

  /**
   * List all databases in the organization
   */
  async listDatabases(): Promise<CreateDatabaseResponse['database'][]> {
    const url = `${this.config.apiBaseUrl}/v1/organizations/${this.config.organization}/databases`;

    const response = await this.fetch(url, {
      method: 'GET',
    });

    return (response as any).databases || [];
  }

  /**
   * Internal fetch wrapper with auth and error handling
   */
  private async fetch(url: string, options: RequestInit = {}): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Turso Platform API error (${response.status}): ${errorText || response.statusText}`,
        );
      }

      // Handle empty responses (e.g., DELETE)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return {};
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Turso Platform API request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
