// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Data Import Strategy
 * Defines how the engine handles existing records.
 */
import { lazySchema } from '../shared/lazy-schema';
export const DatasetMode = z.enum([
  'insert',    // Try to insert, fail on duplicate
  'update',    // Only update found records, ignore new
  'upsert',    // Create new or Update existing (Standard)
  'replace',   // Delete ALL records in object then insert (Dangerous - use for cache tables)
  'ignore'     // Try to insert, silently skip duplicates
]);

/**
 * Dataset Schema (Seed Data / Fixtures)
 * 
 * Standardized format for transporting data.
 * Used for:
 * 1. System Bootstrapping (Admin accounts, Standard Roles)
 * 2. Reference Data (Countries, Currencies)
 * 3. Demo/Test Data
 */
export const DatasetSchema = lazySchema(() => z.object({
  /** 
   * Target Object 
   * The machine name of the object to populate.
   */
  object: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Target Object Name'),

  /** 
   * Idempotency Key (The "Upsert" Key)
   * The field used to check if a record already exists.
   * Best Practice: Use a natural key like 'code', 'slug', 'username' or 'external_id'.
   * Standard: 'id' is rarely used for portable seed data — prefer natural keys.
   */
  externalId: z.string().default('name').describe('Field match for uniqueness check'),

  /** 
   * Import Strategy
   */
  mode: DatasetMode.default('upsert').describe('Conflict resolution strategy'),

  /**
   * Environment Scope
   * - 'all': Always load
   * - 'dev': Only for development/demo
   * - 'test': Only for CI/CD tests
   */
  env: z.array(z.enum(['prod', 'dev', 'test'])).default(['prod', 'dev', 'test']).describe('Applicable environments'),

  /** 
   * The Payload
   * Array of raw JSON objects matching the Object Schema.
   */
  records: z.array(z.record(z.string(), z.unknown())).describe('Data records'),
}));

/** Parsed/output type — all defaults are applied (env, mode, externalId always present) */
export type Dataset = z.infer<typeof DatasetSchema>;

/** Input type — fields with defaults (env, mode, externalId) are optional */
export type DatasetInput = z.input<typeof DatasetSchema>;

export type DatasetImportMode = z.infer<typeof DatasetMode>;
