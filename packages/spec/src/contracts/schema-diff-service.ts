// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ISchemaDiffService - Schema Introspection & Diff Contract
 *
 * Compares the desired metadata state (ObjectStack object definitions)
 * against the current database schema and generates DDL migration plans.
 *
 * Pipeline: Introspect Current → Diff vs Desired → Generate Migrations → Apply
 *
 * This service is dialect-aware and generates DDL appropriate for the
 * target database (PostgreSQL, SQLite/Turso, MySQL, etc.).
 */

import type { DeployDiff, MigrationPlan } from '../system/deploy-bundle.zod.js';
import type { SQLDialect } from '../data/driver-sql.zod.js';

// ==========================================================================
// Types
// ==========================================================================

/**
 * Introspected schema representation of the current database state.
 */
export interface IntrospectedSchema {
  /** Object/table names and their column definitions */
  tables: Record<string, IntrospectedTable>;
  /** Database dialect */
  dialect: string;
  /** Introspection timestamp (ISO 8601) */
  introspectedAt: string;
}

/**
 * Introspected table (current database state).
 */
export interface IntrospectedTable {
  /** Table name */
  name: string;
  /** Column definitions */
  columns: IntrospectedColumn[];
  /** Index definitions */
  indexes: IntrospectedIndex[];
}

/**
 * Introspected column definition.
 */
export interface IntrospectedColumn {
  /** Column name */
  name: string;
  /** SQL data type */
  type: string;
  /** Whether the column is nullable */
  nullable: boolean;
  /** Default value expression */
  defaultValue?: string;
  /** Whether this column is a primary key */
  primaryKey: boolean;
}

/**
 * Introspected index definition.
 */
export interface IntrospectedIndex {
  /** Index name */
  name: string;
  /** Columns included in the index */
  columns: string[];
  /** Whether the index enforces uniqueness */
  unique: boolean;
}

/**
 * Migration apply result.
 */
export interface MigrationApplyResult {
  /** Whether all migrations applied successfully */
  success: boolean;
  /** Number of statements executed */
  statementsExecuted: number;
  /** Total execution duration in milliseconds */
  durationMs: number;
  /** Error message if a statement failed */
  error?: string;
  /** Index of the failed statement (if any) */
  failedAtIndex?: number;
}

// ==========================================================================
// Service Interface
// ==========================================================================

export interface ISchemaDiffService {
  /**
   * Introspect the current database schema.
   * Reads table definitions, columns, indexes from the live database.
   *
   * @param driver - Data driver to introspect
   * @returns Current schema representation
   */
  introspect(driver: unknown): Promise<IntrospectedSchema>;

  /**
   * Compute the diff between current schema and desired object definitions.
   *
   * @param current - Introspected current schema
   * @param desired - Desired ObjectStack object definitions
   * @returns Schema diff describing all changes
   */
  diff(current: IntrospectedSchema, desired: Record<string, unknown>[]): DeployDiff;

  /**
   * Generate SQL migration statements from a schema diff.
   * Output is dialect-specific (PostgreSQL, SQLite, etc.).
   *
   * @param diff - Schema diff to generate migrations for
   * @param dialect - Target SQL dialect
   * @returns Ordered migration plan
   */
  generateMigrations(diff: DeployDiff, dialect: SQLDialect): MigrationPlan;

  /**
   * Apply a migration plan to the database.
   * Executes statements in order within a transaction (when supported).
   *
   * @param driver - Data driver to apply migrations to
   * @param plan - Migration plan to execute
   * @returns Apply result with success status and timing
   */
  applyMigrations(driver: unknown, plan: MigrationPlan): Promise<MigrationApplyResult>;
}
