// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ITursoPlatformService - Turso Platform API Contract
 *
 * Defines the interface for interacting with the Turso Platform API
 * to manage tenant databases in a DB-per-Tenant architecture.
 *
 * This contract abstracts the Turso REST API so that:
 * - The provisioning service can create/delete databases per tenant
 * - The router can issue scoped auth tokens per tenant
 * - The admin console can list and manage tenant databases
 *
 * Implemented by: `@objectstack/driver-turso`
 *
 * @see https://docs.turso.tech/api-reference
 */

// ==========================================================================
// Types
// ==========================================================================

/**
 * Token access scope for Turso database tokens.
 */
export type TursoTokenScope = 'full-access' | 'read-only';

/**
 * Information about a Turso database instance.
 */
export interface TursoDatabaseInfo {
  /** Database name (unique within the organization) */
  name: string;
  /** Database unique identifier */
  dbId: string;
  /** Database hostname (e.g., 'mydb-myorg.turso.io') */
  hostname: string;
  /** Turso group the database belongs to */
  group: string;
  /** Primary region code (e.g., 'iad') */
  primaryRegion: string;
  /** Replica regions */
  regions: string[];
  /** Database type ('logical' or 'schema') */
  type: string;
  /** Database version */
  version: string;
  /** Whether the database is currently sleeping */
  sleeping: boolean;
}

/**
 * Options for creating a new Turso database.
 */
export interface CreateTursoDatabaseOptions {
  /** Database name (must be unique within the organization) */
  name: string;
  /** Group to create the database in */
  group: string;
  /** Optional schema database for multi-db schemas */
  schemaDatabase?: string;
  /** Optional seed configuration to pre-populate data */
  seed?: {
    type: 'database' | 'dump';
    name?: string;
    url?: string;
  };
}

/**
 * Result of creating a Turso database token.
 */
export interface TursoTokenResult {
  /** The JWT token string */
  jwt: string;
  /** Token expiration (ISO 8601) or undefined for non-expiring tokens */
  expiration?: string;
}

// ==========================================================================
// Service Interface
// ==========================================================================

export interface ITursoPlatformService {
  /**
   * Create a new Turso database for a tenant.
   * @param options - Database creation options
   * @returns Information about the created database
   */
  createDatabase(options: CreateTursoDatabaseOptions): Promise<TursoDatabaseInfo>;

  /**
   * Delete a Turso database.
   * @param databaseName - Name of the database to delete
   */
  deleteDatabase(databaseName: string): Promise<void>;

  /**
   * List all databases in the organization.
   * @param group - Optional group filter
   * @returns Array of database info objects
   */
  listDatabases(group?: string): Promise<TursoDatabaseInfo[]>;

  /**
   * Get information about a specific database.
   * @param databaseName - Name of the database
   * @returns Database information or null if not found
   */
  getDatabase(databaseName: string): Promise<TursoDatabaseInfo | null>;

  /**
   * Create a scoped auth token for a specific database.
   * @param databaseName - Name of the database
   * @param scope - Token access scope
   * @param expiration - Optional expiration (e.g., '2w', '90d', 'never')
   * @returns Token result with JWT string
   */
  createToken(databaseName: string, scope: TursoTokenScope, expiration?: string): Promise<TursoTokenResult>;

  /**
   * Revoke all tokens for a specific database.
   * Forces all existing connections to re-authenticate.
   * @param databaseName - Name of the database
   */
  revokeTokens(databaseName: string): Promise<void>;
}
