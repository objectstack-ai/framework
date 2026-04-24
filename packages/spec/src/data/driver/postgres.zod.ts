// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * PostgreSQL Driver Configuration Schema
 * Defines the connection settings specific to PostgreSQL.
 */
import { lazySchema } from '../../shared/lazy-schema';
export const PostgresConfigSchema = lazySchema(() => z.object({
  /**
   * Connection URI.
   * If provided, it takes precedence over host/port/database.
   * Format: postgresql://[user[:password]@][netloc][:port][/dbname][?param1=value1&...]
   */
  url: z.string().optional().describe('Connection URI'),

  /**
   * Database Name.
   */
  database: z.string().describe('Database Name'),

  /**
   * Hostname or IP address.
   * Defaults to localhost.
   */
  host: z.string().default('localhost').describe('Host address'),

  /**
   * Port number.
   * Defaults to 5432.
   */
  port: z.number().default(5432).describe('Port number'),

  /**
   * Authentication Username.
   */
  username: z.string().optional().describe('Auth User'),

  /**
   * Authentication Password.
   */
  password: z.string().optional().describe('Auth Password'),

  /**
   * Default Schema.
   * The schema to use for tables that do not specify a schema.
   * Defaults to 'public'.
   */
  schema: z.string().default('public').describe('Default Schema'),

  /**
   * Enable SSL/TLS.
   * Can be a boolean or an object with specific SSL configuration (ca, cert, key, rejectUnauthorized).
   */
  ssl: z.union([
    z.boolean(),
    z.object({
      rejectUnauthorized: z.boolean().optional(),
      ca: z.string().optional(),
      key: z.string().optional(),
      cert: z.string().optional(),
    })
  ]).optional().describe('Enable SSL'),

  /**
   * Application Name.
   * Sets the application_name configuration parameter.
   */
  applicationName: z.string().optional().describe('Application Name'),

  /**
   * Connection Pool: Max Clients.
   * Maximum number of clients the pool should contain.
   */
  max: z.number().default(10).describe('Max Pool Size'),

  /**
   * Connection Pool: Min Clients.
   * Minimum number of clients to keep in the pool.
   */
  min: z.number().default(0).describe('Min Pool Size'),

  /**
   * Idle Timeout (ms).
   * The number of milliseconds a client must sit idle in the pool and not be checked out
   * before it is disconnected from the backend and discarded.
   */
  idleTimeoutMillis: z.number().optional().describe('Idle Timeout (ms)'),

  /**
   * Connection Timeout (ms).
   * The number of milliseconds to wait before timing out when connecting a new client.
   */
  connectionTimeoutMillis: z.number().optional().describe('Connection Timeout (ms)'),

   /**
   * Statement Timeout (ms).
   * Abort any statement that takes more than the specified number of milliseconds.
   */
   statementTimeout: z.number().optional().describe('Statement Timeout (ms)'),
}));

export type PostgresConfig = z.infer<typeof PostgresConfigSchema>;
