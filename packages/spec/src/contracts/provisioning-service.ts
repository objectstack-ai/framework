// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * IProvisioningService - Tenant Provisioning Service Contract
 *
 * Defines the interface for the "Register → Instant ObjectOS" provisioning pipeline.
 * Manages the complete tenant lifecycle: create → active → suspend → resume → destroy.
 *
 * The provisioning service orchestrates:
 * 1. Turso database creation via ITursoPlatformService
 * 2. Schema synchronization via ISchemaDiffService
 * 3. Seed data population
 * 4. Tenant record registration in the control plane
 *
 * Follows Dependency Inversion Principle - consumers depend on this interface,
 * not on concrete provisioning implementations.
 */

import type {
  TenantProvisioningRequest,
  TenantProvisioningResult,
  TenantProvisioningStatus,
  TenantPlan,
} from '../system/provisioning.zod.js';

// ==========================================================================
// Service Interface
// ==========================================================================

export interface IProvisioningService {
  /**
   * Provision a new tenant with an isolated database.
   * Creates the Turso database, syncs schema, seeds data, and registers the tenant.
   * Target latency: 2-5 seconds.
   *
   * @param request - Provisioning request with org, plan, and region
   * @returns Provisioning result with tenant ID, connection URL, and step statuses
   */
  provisionTenant(request: TenantProvisioningRequest): Promise<TenantProvisioningResult>;

  /**
   * Suspend a tenant (e.g., unpaid, policy violation).
   * Revokes tokens and sets the database to read-only mode.
   *
   * @param tenantId - Tenant to suspend
   */
  suspendTenant(tenantId: string): Promise<void>;

  /**
   * Resume a previously suspended tenant.
   * Restores full read-write access and issues new tokens.
   *
   * @param tenantId - Tenant to resume
   */
  resumeTenant(tenantId: string): Promise<void>;

  /**
   * Permanently destroy a tenant and its database.
   * Optionally creates a final backup before deletion.
   * Respects the grace period defined in lifecycle hooks.
   *
   * @param tenantId - Tenant to destroy
   */
  destroyTenant(tenantId: string): Promise<void>;

  /**
   * Get the current provisioning status of a tenant.
   *
   * @param tenantId - Tenant to query
   * @returns Current provisioning status
   */
  getTenantStatus(tenantId: string): Promise<TenantProvisioningStatus>;

  /**
   * Migrate a tenant to a different subscription plan.
   * Updates quotas and resource limits accordingly.
   *
   * @param tenantId - Tenant to migrate
   * @param newPlan - Target subscription plan
   */
  migrateTenantPlan(tenantId: string, newPlan: TenantPlan): Promise<void>;
}
