// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * IDeployPipelineService - Metadata-Driven Deployment Pipeline Contract
 *
 * Orchestrates the complete deployment lifecycle:
 * 1. Validate bundle (Zod schema validation)
 * 2. Plan deployment (introspect → diff → generate migrations)
 * 3. Execute deployment (apply migrations → register metadata)
 * 4. Rollback on failure
 *
 * Target: 2-5 second deployments for schema changes.
 * No Docker builds, no CI/CD pipelines — just metadata push.
 */

import type {
  DeployBundle,
  DeployValidationResult,
  MigrationPlan,
  DeployStatus,
} from '../system/deploy-bundle.zod.js';

// ==========================================================================
// Types
// ==========================================================================

/**
 * Deployment execution result.
 */
export interface DeployExecutionResult {
  /** Unique deployment identifier */
  deploymentId: string;
  /** Final deployment status */
  status: DeployStatus;
  /** Total execution duration in milliseconds */
  durationMs: number;
  /** Number of DDL statements executed */
  statementsExecuted: number;
  /** Error message if deployment failed */
  error?: string;
  /** Timestamp of deployment completion (ISO 8601) */
  completedAt: string;
}

// ==========================================================================
// Service Interface
// ==========================================================================

export interface IDeployPipelineService {
  /**
   * Validate a deploy bundle against Zod schemas.
   * Checks object definitions, view configs, flow definitions, and permissions.
   *
   * @param bundle - Deploy bundle to validate
   * @returns Validation result with issues list
   */
  validateBundle(bundle: DeployBundle): DeployValidationResult;

  /**
   * Plan a deployment by introspecting the current schema and generating
   * a migration plan for the diff.
   *
   * @param tenantId - Target tenant
   * @param bundle - Deploy bundle to plan for
   * @returns Migration plan with ordered DDL statements
   */
  planDeployment(tenantId: string, bundle: DeployBundle): Promise<MigrationPlan>;

  /**
   * Execute a deployment plan against a tenant's database.
   * Applies DDL statements and registers metadata changes.
   *
   * @param tenantId - Target tenant
   * @param plan - Migration plan to execute
   * @returns Execution result with deployment ID and status
   */
  executeDeployment(tenantId: string, plan: MigrationPlan): Promise<DeployExecutionResult>;

  /**
   * Rollback a previous deployment.
   * Executes reverse DDL statements and restores previous metadata state.
   *
   * @param tenantId - Target tenant
   * @param deploymentId - Deployment to rollback
   */
  rollbackDeployment(tenantId: string, deploymentId: string): Promise<void>;
}
