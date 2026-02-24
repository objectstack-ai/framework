// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Tenant Provisioning Protocol
 *
 * Defines the schemas for the "Register → Instant ObjectOS" provisioning pipeline:
 * 1. User registers → ProvisioningRequest created
 * 2. Turso database created → Schema synced → Seed data applied
 * 3. Tenant status transitions: provisioning → active
 *
 * Provisioning is designed to be:
 * - **Idempotent**: Re-running the same request produces the same result
 * - **Observable**: Each step has explicit status tracking
 * - **Fast**: Target 2-5 seconds for complete provisioning
 */

// ==========================================================================
// 1. Enums & Constants
// ==========================================================================

/**
 * Tenant provisioning lifecycle status.
 */
export const TenantProvisioningStatusEnum = z.enum([
  'provisioning',  // Database creation in progress
  'active',        // Fully provisioned and operational
  'suspended',     // Temporarily disabled (billing, policy)
  'failed',        // Provisioning failed (requires retry or manual intervention)
  'destroying',    // Deletion in progress
]).describe('Tenant provisioning lifecycle status');

export type TenantProvisioningStatus = z.infer<typeof TenantProvisioningStatusEnum>;

/**
 * Tenant subscription plan.
 */
export const TenantPlanSchema = z.enum([
  'free',        // Free tier with limited quotas
  'pro',         // Professional tier with higher quotas
  'enterprise',  // Enterprise tier with custom quotas and SLAs
]).describe('Tenant subscription plan');

export type TenantPlan = z.infer<typeof TenantPlanSchema>;

/**
 * Available deployment regions.
 */
export const TenantRegionSchema = z.enum([
  'us-east',     // US East (Virginia)
  'us-west',     // US West (Oregon)
  'eu-west',     // EU West (Ireland)
  'eu-central',  // EU Central (Frankfurt)
  'ap-southeast',// Asia Pacific (Singapore)
  'ap-northeast',// Asia Pacific (Tokyo)
]).describe('Available deployment region');

export type TenantRegion = z.infer<typeof TenantRegionSchema>;

// ==========================================================================
// 2. Provisioning Step Tracking
// ==========================================================================

/**
 * Individual provisioning step status.
 * Tracks the progress of each step in the provisioning pipeline.
 */
export const ProvisioningStepSchema = z.object({
  /** Step identifier */
  name: z.string().min(1).describe('Step name (e.g., create_database, sync_schema)'),

  /** Step execution status */
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']).describe('Step status'),

  /** When the step started (ISO 8601) */
  startedAt: z.string().datetime().optional().describe('Step start time'),

  /** When the step completed (ISO 8601) */
  completedAt: z.string().datetime().optional().describe('Step completion time'),

  /** Duration in milliseconds */
  durationMs: z.number().int().min(0).optional().describe('Step duration in ms'),

  /** Error message if the step failed */
  error: z.string().optional().describe('Error message on failure'),
}).describe('Individual provisioning step status');

export type ProvisioningStep = z.infer<typeof ProvisioningStepSchema>;

// ==========================================================================
// 3. Provisioning Request & Result
// ==========================================================================

/**
 * Tenant Provisioning Request.
 * Input for creating a new tenant with its isolated database.
 */
export const TenantProvisioningRequestSchema = z.object({
  /** Organization ID that owns this tenant */
  orgId: z.string().min(1).describe('Organization ID'),

  /** Requested subscription plan */
  plan: TenantPlanSchema.default('free'),

  /** Preferred deployment region */
  region: TenantRegionSchema.default('us-east'),

  /** Optional tenant display name */
  displayName: z.string().optional().describe('Tenant display name'),

  /** Optional initial admin user email */
  adminEmail: z.string().email().optional().describe('Initial admin user email'),

  /** Optional metadata to attach to the tenant */
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
}).describe('Tenant provisioning request');

export type TenantProvisioningRequest = z.infer<typeof TenantProvisioningRequestSchema>;

/**
 * Tenant Provisioning Result.
 * Output after provisioning completes (or fails).
 */
export const TenantProvisioningResultSchema = z.object({
  /** Unique tenant identifier */
  tenantId: z.string().min(1).describe('Provisioned tenant ID'),

  /** Database connection URL (libsql:// or https://) */
  connectionUrl: z.string().min(1).describe('Database connection URL'),

  /** Current provisioning status */
  status: TenantProvisioningStatusEnum,

  /** Deployment region */
  region: TenantRegionSchema,

  /** Active subscription plan */
  plan: TenantPlanSchema,

  /** Provisioning pipeline steps with status */
  steps: z.array(ProvisioningStepSchema).default([]).describe('Pipeline step statuses'),

  /** Total provisioning duration in milliseconds */
  totalDurationMs: z.number().int().min(0).optional().describe('Total provisioning duration'),

  /** Provisioned timestamp (ISO 8601) */
  provisionedAt: z.string().datetime().optional().describe('Provisioning completion time'),

  /** Error message if provisioning failed */
  error: z.string().optional().describe('Error message on failure'),
}).describe('Tenant provisioning result');

export type TenantProvisioningResult = z.infer<typeof TenantProvisioningResultSchema>;
