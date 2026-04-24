// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { DriverDefinitionSchema } from '../datasource.zod';

/**
 * MongoDB Standard Driver Protocol
 * 
 * Defines the strict schema for MongoDB connection and capabilities.
 * This is used by the Platform to validate `datasource.config` when `driver: 'mongo'`.
 */

// ==========================================================================
// 1. Connection Configuration
// ==========================================================================

import { lazySchema } from '../../shared/lazy-schema';
export const MongoConfigSchema = lazySchema(() => z.object({
  /**
   * Connection URI (Standard Connection String)
   * If provided, host/port/username/password fields may be ignored or merged depending on driver logic.
   * Format: mongodb://[username:password@]host1[:port1][,...hostN[:portN]][/[defaultauthdb][?options]]
   */
  url: z.string().describe('Connection URI').optional(),

  /**
   * Database Name (Required)
   * The logical database to store collections.
   */
  database: z.string().min(1).describe('Database Name'),

  /** Hostname (Optional if url is provided) */
  host: z.string().default('127.0.0.1').describe('Host address').optional(),

  /** Port (Optional, default 27017) */
  port: z.number().int().default(27017).describe('Port number').optional(),

  /** Username for authentication */
  username: z.string().describe('Authentication Username').optional(),

  /** Password for authentication */
  password: z.string().describe('Authentication Password').optional(),
  
  /** Authentication Database (Defaults to admin or database name) */
  authSource: z.string().describe('Authentication Database').optional(),

  /**
   * Connection Options
   * Passthrough options to the underlying MongoDB driver (e.g. valid certs, timeouts)
   */
  options: z.record(z.string(), z.unknown()).describe('Extra driver options (ssl, poolSize, etc)').optional(),
}).describe('MongoDB Connection Configuration'));

// ==========================================================================
// 2. Driver Definition (Metadata)
// ==========================================================================

/**
 * The static definition of the Mongo driver's capabilities and default metadata.
 * This implements the `DriverDefinitionSchema` contract.
 */
export const MongoDriverSpec = DriverDefinitionSchema.parse({
  id: 'mongo',
  label: 'MongoDB',
  description: 'Official MongoDB Driver for ObjectStack. Supports rich queries, aggregation, and atomic updates.',
  icon: 'database',
  configSchema: {}, // Will be populated with JSON Schema version of MongoConfigSchema at runtime
  capabilities: {
    transactions: true,
    // Query
    queryFilters: true,
    queryAggregations: true,
    querySorting: true,
    queryPagination: true,
    fullTextSearch: true,
    // Schema
    dynamicSchema: true,
  }
});

/**
 * Derived Types
 */
export type MongoConfig = z.infer<typeof MongoConfigSchema>;
