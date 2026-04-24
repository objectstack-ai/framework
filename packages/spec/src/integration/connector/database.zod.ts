// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import {
  ConnectorSchema,
  FieldMappingSchema,
} from '../connector.zod';

/**
 * Database Connector Protocol Template
 * 
 * Specialized connector for database systems (PostgreSQL, MySQL, SQL Server, etc.)
 * Extends the base connector with database-specific features like schema discovery,
 * CDC (Change Data Capture), and connection pooling.
 */

/**
 * Database Provider Types
 */
import { lazySchema } from '../../shared/lazy-schema';
export const DatabaseProviderSchema = lazySchema(() => z.enum([
  'postgresql',
  'mysql',
  'mariadb',
  'mssql',
  'oracle',
  'mongodb',
  'redis',
  'cassandra',
  'snowflake',
  'bigquery',
  'redshift',
  'custom',
]).describe('Database provider type'));

export type DatabaseProvider = z.infer<typeof DatabaseProviderSchema>;

/**
 * Database Connection Pool Configuration
 */
export const DatabasePoolConfigSchema = lazySchema(() => z.object({
  min: z.number().min(0).default(2).describe('Minimum connections in pool'),
  max: z.number().min(1).default(10).describe('Maximum connections in pool'),
  idleTimeoutMs: z.number().min(1000).default(30000).describe('Idle connection timeout in ms'),
  connectionTimeoutMs: z.number().min(1000).default(10000).describe('Connection establishment timeout in ms'),
  acquireTimeoutMs: z.number().min(1000).default(30000).describe('Connection acquisition timeout in ms'),
  evictionRunIntervalMs: z.number().min(1000).default(30000).describe('Connection eviction check interval in ms'),
  testOnBorrow: z.boolean().default(true).describe('Test connection before use'),
}));

export type DatabasePoolConfig = z.infer<typeof DatabasePoolConfigSchema>;

/**
 * SSL/TLS Configuration
 */
export const SslConfigSchema = lazySchema(() => z.object({
  enabled: z.boolean().default(false).describe('Enable SSL/TLS'),
  rejectUnauthorized: z.boolean().default(true).describe('Reject unauthorized certificates'),
  ca: z.string().optional().describe('Certificate Authority certificate'),
  cert: z.string().optional().describe('Client certificate'),
  key: z.string().optional().describe('Client private key'),
}));

export type SslConfig = z.infer<typeof SslConfigSchema>;

/**
 * Change Data Capture (CDC) Configuration
 */
export const CdcConfigSchema = lazySchema(() => z.object({
  enabled: z.boolean().default(false).describe('Enable CDC'),
  
  method: z.enum([
    'log_based',      // Transaction log parsing (e.g., PostgreSQL logical replication)
    'trigger_based',  // Database triggers for change tracking
    'query_based',    // Timestamp-based queries
    'custom',         // Custom CDC implementation
  ]).describe('CDC method'),
  
  slotName: z.string().optional().describe('Replication slot name (for log-based CDC)'),
  
  publicationName: z.string().optional().describe('Publication name (for PostgreSQL)'),
  
  startPosition: z.string().optional().describe('Starting position/LSN for CDC stream'),
  
  batchSize: z.number().min(1).max(10000).default(1000).describe('CDC batch size'),
  
  pollIntervalMs: z.number().min(100).default(1000).describe('CDC polling interval in ms'),
}));

export type CdcConfig = z.infer<typeof CdcConfigSchema>;

/**
 * Database Table Configuration
 */
export const DatabaseTableSchema = lazySchema(() => z.object({
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Table name in ObjectStack (snake_case)'),
  label: z.string().describe('Display label'),
  schema: z.string().optional().describe('Database schema name'),
  tableName: z.string().describe('Actual table name in database'),
  primaryKey: z.string().describe('Primary key column'),
  enabled: z.boolean().default(true).describe('Enable sync for this table'),
  fieldMappings: z.array(FieldMappingSchema).optional().describe('Table-specific field mappings'),
  whereClause: z.string().optional().describe('SQL WHERE clause for filtering'),
}));

export type DatabaseTable = z.infer<typeof DatabaseTableSchema>;

/**
 * Database Connector Configuration Schema
 */
export const DatabaseConnectorSchema = lazySchema(() => ConnectorSchema.extend({
  type: z.literal('database'),
  
  /**
   * Database provider
   */
  provider: DatabaseProviderSchema.describe('Database provider type'),
  
  /**
   * Connection configuration
   */
  connectionConfig: z.object({
    host: z.string().describe('Database host'),
    port: z.number().min(1).max(65535).describe('Database port'),
    database: z.string().describe('Database name'),
    username: z.string().describe('Database username'),
    password: z.string().describe('Database password (typically from ENV)'),
    options: z.record(z.string(), z.unknown()).optional().describe('Driver-specific connection options'),
  }).describe('Database connection configuration'),
  
  /**
   * Connection pool configuration
   */
  poolConfig: DatabasePoolConfigSchema.optional().describe('Connection pool configuration'),
  
  /**
   * SSL/TLS configuration
   */
  sslConfig: SslConfigSchema.optional().describe('SSL/TLS configuration'),
  
  /**
   * Tables to sync
   */
  tables: z.array(DatabaseTableSchema).describe('Tables to sync'),
  
  /**
   * Change Data Capture configuration
   */
  cdcConfig: CdcConfigSchema.optional().describe('CDC configuration'),
  
  /**
   * Read replica configuration
   */
  readReplicaConfig: z.object({
    enabled: z.boolean().default(false).describe('Use read replicas'),
    hosts: z.array(z.object({
      host: z.string().describe('Replica host'),
      port: z.number().min(1).max(65535).describe('Replica port'),
      weight: z.number().min(0).max(1).default(1).describe('Load balancing weight'),
    })).describe('Read replica hosts'),
  }).optional().describe('Read replica configuration'),
  
  /**
   * Query timeout
   */
  queryTimeoutMs: z.number().min(1000).max(300000).optional().default(30000).describe('Query timeout in ms'),
  
  /**
   * Enable query logging
   */
  enableQueryLogging: z.boolean().optional().default(false).describe('Enable SQL query logging'),
}));

export type DatabaseConnector = z.infer<typeof DatabaseConnectorSchema>;

// ============================================================================
// Helper Functions & Examples
// ============================================================================

/**
 * Example: PostgreSQL Connector Configuration
 */
export const postgresConnectorExample = {
  name: 'postgres_production',
  label: 'Production PostgreSQL',
  type: 'database',
  provider: 'postgresql',
  authentication: {
    type: 'basic',
    username: '${DB_USERNAME}',
    password: '${DB_PASSWORD}',
  },
  connectionConfig: {
    host: 'db.example.com',
    port: 5432,
    database: 'production',
    username: '${DB_USERNAME}',
    password: '${DB_PASSWORD}',
  },
  poolConfig: {
    min: 2,
    max: 20,
    idleTimeoutMs: 30000,
    connectionTimeoutMs: 10000,
    acquireTimeoutMs: 30000,
    evictionRunIntervalMs: 30000,
    testOnBorrow: true,
  },
  sslConfig: {
    enabled: true,
    rejectUnauthorized: true,
  },
  tables: [
    {
      name: 'customer',
      label: 'Customer',
      schema: 'public',
      tableName: 'customers',
      primaryKey: 'id',
      enabled: true,
    },
    {
      name: 'order',
      label: 'Order',
      schema: 'public',
      tableName: 'orders',
      primaryKey: 'id',
      enabled: true,
      whereClause: 'status != \'archived\'',
    },
  ],
  cdcConfig: {
    enabled: true,
    method: 'log_based',
    slotName: 'objectstack_replication_slot',
    publicationName: 'objectstack_publication',
    batchSize: 1000,
    pollIntervalMs: 1000,
  },
  syncConfig: {
    strategy: 'incremental',
    direction: 'bidirectional',
    realtimeSync: true,
    conflictResolution: 'latest_wins',
    batchSize: 1000,
    deleteMode: 'soft_delete',
  },
  status: 'active',
  enabled: true,
};

/**
 * Example: MongoDB Connector Configuration
 */
export const mongoConnectorExample = {
  name: 'mongodb_analytics',
  label: 'MongoDB Analytics',
  type: 'database',
  provider: 'mongodb',
  authentication: {
    type: 'basic',
    username: '${MONGO_USERNAME}',
    password: '${MONGO_PASSWORD}',
  },
  connectionConfig: {
    host: 'mongodb.example.com',
    port: 27017,
    database: 'analytics',
    username: '${MONGO_USERNAME}',
    password: '${MONGO_PASSWORD}',
    options: {
      authSource: 'admin',
      replicaSet: 'rs0',
    },
  },
  tables: [
    {
      name: 'event',
      label: 'Event',
      tableName: 'events',
      primaryKey: 'id',
      enabled: true,
    },
  ],
  cdcConfig: {
    enabled: true,
    method: 'log_based',
    batchSize: 1000,
    pollIntervalMs: 500,
  },
  syncConfig: {
    strategy: 'incremental',
    direction: 'import',
    batchSize: 1000,
  },
  status: 'active',
  enabled: true,
};

/**
 * Example: Snowflake Connector Configuration
 */
export const snowflakeConnectorExample = {
  name: 'snowflake_warehouse',
  label: 'Snowflake Data Warehouse',
  type: 'database',
  provider: 'snowflake',
  authentication: {
    type: 'basic',
    username: '${SNOWFLAKE_USERNAME}',
    password: '${SNOWFLAKE_PASSWORD}',
  },
  connectionConfig: {
    host: 'account.snowflakecomputing.com',
    port: 443,
    database: 'ANALYTICS_DB',
    username: '${SNOWFLAKE_USERNAME}',
    password: '${SNOWFLAKE_PASSWORD}',
    options: {
      warehouse: 'COMPUTE_WH',
      schema: 'PUBLIC',
      role: 'ANALYST',
    },
  },
  tables: [
    {
      name: 'sales_summary',
      label: 'Sales Summary',
      schema: 'PUBLIC',
      tableName: 'SALES_SUMMARY',
      primaryKey: 'ID',
      enabled: true,
    },
  ],
  syncConfig: {
    strategy: 'full',
    direction: 'import',
    schedule: '0 2 * * *', // Daily at 2 AM
    batchSize: 5000,
  },
  queryTimeoutMs: 60000,
  status: 'active',
  enabled: true,
};
