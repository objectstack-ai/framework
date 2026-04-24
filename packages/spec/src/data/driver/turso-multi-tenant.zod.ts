// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Turso Multi-Tenant Router Schema
 *
 * Defines the configuration for Turso DB-per-Tenant architectures where each
 * tenant receives an independent Turso/libSQL database. The router resolves
 * the correct database URL and auth token per request based on the current
 * tenant context.
 *
 * Architecture: Shared Compute + Isolated Data
 * - Serverless functions are shared across tenants
 * - Each tenant has a physically isolated Turso database
 * - Turso Platform API manages database lifecycle (create/delete/suspend)
 *
 * @see https://docs.turso.tech/features/multi-db-schemas
 */

// ==========================================================================
// 1. Tenant Resolver Strategy
// ==========================================================================

/**
 * Strategy for resolving which tenant database to connect to.
 */
import { lazySchema } from '../../shared/lazy-schema';
export const TenantResolverStrategySchema = lazySchema(() => z.enum([
  'header',       // Resolve from X-Tenant-ID request header
  'subdomain',    // Resolve from subdomain (e.g., acme.app.com → acme)
  'path',         // Resolve from URL path segment (e.g., /api/acme/...)
  'token',        // Resolve from JWT claim (e.g., tenant_id in access token)
  'lookup',       // Resolve from control-plane database lookup
]).describe('Strategy for resolving tenant identity from request context'));

export type TenantResolverStrategy = z.infer<typeof TenantResolverStrategySchema>;

// ==========================================================================
// 2. Turso Group Configuration
// ==========================================================================

/**
 * Turso Database Group Configuration.
 * Groups allow databases to share schema and be managed as a unit.
 * All databases in a group are deployed to the same set of locations.
 *
 * @see https://docs.turso.tech/features/multi-db-schemas
 */
export const TursoGroupSchema = lazySchema(() => z.object({
  /**
   * Group name identifier.
   * Used to reference the group when creating new tenant databases.
   */
  name: z.string().min(1).describe('Turso database group name'),

  /**
   * Primary location for the group (Turso region code).
   * Example: 'iad' (US East), 'lhr' (London), 'nrt' (Tokyo)
   */
  primaryLocation: z.string().min(2).describe('Primary Turso region code (e.g., iad, lhr, nrt)'),

  /**
   * Additional replica locations for read performance.
   * Databases in this group will have read replicas in these regions.
   */
  replicaLocations: z.array(z.string().min(2)).default([]).describe('Additional replica region codes'),

  /**
   * Schema database name within the group.
   * When using multi-db schemas, this is the "parent" database
   * whose schema is shared by all child (tenant) databases.
   */
  schemaDatabase: z.string().optional().describe('Schema database name for multi-db schemas'),
}).describe('Turso database group configuration'));

export type TursoGroup = z.infer<typeof TursoGroupSchema>;

// ==========================================================================
// 3. Tenant Database Lifecycle Hooks
// ==========================================================================

/**
 * Database Lifecycle Hook Schema.
 * Defines what happens at each tenant lifecycle event.
 */
export const TenantDatabaseLifecycleSchema = lazySchema(() => z.object({
  /**
   * Hook executed when a new tenant is created.
   * Defines how the tenant database is provisioned.
   */
  onTenantCreate: z.object({
    /** Whether to automatically create a Turso database */
    autoCreate: z.boolean().default(true).describe('Auto-create database on tenant registration'),

    /** Database group to create the database in */
    group: z.string().optional().describe('Turso group for the new database'),

    /** Whether to apply schema from the group schema database */
    applyGroupSchema: z.boolean().default(true).describe('Apply shared schema from group'),

    /** Seed data to populate on creation */
    seedData: z.boolean().default(false).describe('Populate seed data on creation'),
  }).describe('Tenant creation hook'),

  /**
   * Hook executed when a tenant is deleted/destroyed.
   */
  onTenantDelete: z.object({
    /** Whether to destroy the database immediately or schedule for deletion */
    immediate: z.boolean().default(false).describe('Destroy database immediately'),

    /** Grace period in hours before permanent deletion (soft-delete) */
    gracePeriodHours: z.number().int().min(0).default(72).describe('Grace period before permanent deletion'),

    /** Whether to create a final backup before deletion */
    createBackup: z.boolean().default(true).describe('Create backup before deletion'),
  }).describe('Tenant deletion hook'),

  /**
   * Hook executed when a tenant is suspended (e.g., unpaid, policy violation).
   */
  onTenantSuspend: z.object({
    /** Whether to revoke auth tokens on suspension */
    revokeTokens: z.boolean().default(true).describe('Revoke auth tokens on suspension'),

    /** Whether to set database to read-only mode */
    readOnly: z.boolean().default(true).describe('Set database to read-only on suspension'),
  }).describe('Tenant suspension hook'),
}).describe('Tenant database lifecycle hooks'));

export type TenantDatabaseLifecycle = z.infer<typeof TenantDatabaseLifecycleSchema>;

// ==========================================================================
// 4. Multi-Tenant Router Configuration
// ==========================================================================

/**
 * Turso Multi-Tenant Configuration Schema.
 *
 * Configures the DB-per-Tenant router that resolves the correct Turso
 * database for each request. Works with the Turso Platform API to manage
 * database lifecycle.
 *
 * @example
 * ```ts
 * const config = TursoMultiTenantConfigSchema.parse({
 *   organizationSlug: 'myorg',
 *   urlTemplate: 'libsql://{tenant_id}-myorg.turso.io',
 *   groupAuthToken: process.env.TURSO_GROUP_AUTH_TOKEN,
 *   tenantResolverStrategy: 'token',
 *   group: {
 *     name: 'production',
 *     primaryLocation: 'iad',
 *     replicaLocations: ['lhr', 'nrt'],
 *     schemaDatabase: 'schema-db',
 *   },
 *   lifecycle: {
 *     onTenantCreate: { autoCreate: true, applyGroupSchema: true },
 *     onTenantDelete: { gracePeriodHours: 168 },
 *     onTenantSuspend: { revokeTokens: true },
 *   },
 * });
 * ```
 */
export const TursoMultiTenantConfigSchema = lazySchema(() => z.object({
  /**
   * Turso organization slug.
   * Used for Platform API calls and URL construction.
   */
  organizationSlug: z.string().min(1).describe('Turso organization slug'),

  /**
   * URL template for constructing tenant database URLs.
   * Use `{tenant_id}` as placeholder for the tenant identifier.
   *
   * Example: 'libsql://{tenant_id}-myorg.turso.io'
   */
  urlTemplate: z.string().min(1).describe('URL template with {tenant_id} placeholder'),

  /**
   * Group-level auth token for Turso Platform API operations.
   * Used for database creation, deletion, and management.
   * This token has full access to all databases in the group.
   */
  groupAuthToken: z.string().min(1).describe('Group-level auth token for platform operations'),

  /**
   * Strategy for resolving tenant identity from the request context.
   */
  tenantResolverStrategy: TenantResolverStrategySchema.default('token'),

  /**
   * Turso database group configuration.
   */
  group: TursoGroupSchema.optional().describe('Database group configuration'),

  /**
   * Lifecycle hooks for tenant database management.
   */
  lifecycle: TenantDatabaseLifecycleSchema.optional().describe('Lifecycle hooks'),

  /**
   * Maximum number of cached tenant database connections.
   * Connections are evicted using LRU strategy when the limit is reached.
   */
  maxCachedConnections: z.number().int().min(1).default(100).describe('Max cached tenant connections (LRU)'),

  /**
   * Connection cache TTL in seconds.
   * Cached connections are refreshed after this period.
   */
  connectionCacheTTL: z.number().int().min(0).default(300).describe('Connection cache TTL in seconds'),
}).describe('Turso multi-tenant router configuration'));

export type TursoMultiTenantConfig = z.infer<typeof TursoMultiTenantConfigSchema>;
