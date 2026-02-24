// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ITenantRouter - Tenant-Aware Request Routing Contract
 *
 * Resolves the correct tenant context and database client for each request.
 * Works with the multi-tenant router to map sessions to tenant databases.
 *
 * Request flow:
 * 1. Extract tenant identity from request (header, subdomain, JWT)
 * 2. Look up tenant configuration from control plane
 * 3. Return or create a cached database client for the tenant
 * 4. Attach tenant context to the request for downstream services
 */

import type { TenantProvisioningStatus, TenantPlan, TenantRegion } from '../system/provisioning.zod.js';

// ==========================================================================
// Types
// ==========================================================================

/**
 * Resolved tenant context attached to each request.
 */
export interface ResolvedTenantContext {
  /** Unique tenant identifier */
  tenantId: string;
  /** Tenant subscription plan */
  plan: TenantPlan;
  /** Deployment region */
  region: TenantRegion;
  /** Database connection URL */
  dbUrl: string;
  /** Current provisioning status */
  status: TenantProvisioningStatus;
}

// ==========================================================================
// Service Interface
// ==========================================================================

export interface ITenantRouter {
  /**
   * Resolve tenant context from an authenticated session.
   * Extracts tenant identity using the configured resolver strategy
   * and looks up the full tenant configuration.
   *
   * @param session - Authenticated session (implementation-specific)
   * @returns Resolved tenant context or null if tenant not found
   */
  resolveTenant(session: unknown): Promise<ResolvedTenantContext | null>;

  /**
   * Get or create a database client for a specific tenant.
   * Uses connection caching with LRU eviction.
   *
   * @param tenantId - Tenant identifier
   * @returns Database client instance (implementation-specific)
   */
  getTenantClient(tenantId: string): Promise<unknown>;

  /**
   * Invalidate the cached connection for a tenant.
   * Called when tenant configuration changes (e.g., plan migration, suspension).
   *
   * @param tenantId - Tenant whose cache to invalidate
   */
  invalidateCache(tenantId: string): void;
}
