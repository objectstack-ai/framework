// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Cube } from '../data/analytics.zod.js';

/**
 * IAnalyticsService - Analytics / BI Service Contract
 *
 * Defines the interface for analytical query execution and semantic layer
 * metadata discovery in ObjectStack. Concrete implementations (Cube.js, custom, etc.)
 * should implement this interface.
 *
 * Follows Dependency Inversion Principle - plugins depend on this interface,
 * not on concrete analytics engine implementations.
 *
 * Aligned with CoreServiceName 'analytics' in core-services.zod.ts.
 */

/**
 * An analytical query definition
 */
export interface AnalyticsQuery {
    /** Target cube name. Optional when cube is specified at a higher level (e.g. API request wrapper or cube-scoped endpoint). Implementations should validate presence at runtime. */
    cube?: string;
    /** Measures to compute (e.g. ['orders.count', 'orders.totalRevenue']) */
    measures: string[];
    /** Dimensions to group by (e.g. ['orders.status', 'orders.createdAt']) */
    dimensions?: string[];
    /** Filter conditions */
    filters?: Array<{
        member: string;
        operator: string;
        values?: string[];
    }>;
    /** Time dimension configuration */
    timeDimensions?: Array<{
        dimension: string;
        granularity?: string;
        dateRange?: string | string[];
    }>;
    /** Sort order for results */
    order?: Record<string, 'asc' | 'desc'>;
    /** Result limit */
    limit?: number;
    /** Result offset */
    offset?: number;
    /** Timezone for date/time calculations */
    timezone?: string;
}

/**
 * Analytics query result
 */
export interface AnalyticsResult {
    /** Result rows */
    rows: Record<string, unknown>[];
    /** Column metadata */
    fields: Array<{
        name: string;
        type: string;
    }>;
    /** Generated SQL (if available) */
    sql?: string;
}

/**
 * Cube metadata for discovery
 */
export interface CubeMeta {
    /** Cube name */
    name: string;
    /** Human-readable title */
    title?: string;
    /** Available measures */
    measures: Array<{ name: string; type: string; title?: string }>;
    /** Available dimensions */
    dimensions: Array<{ name: string; type: string; title?: string }>;
}

export interface IAnalyticsService {
    /**
     * Execute an analytical query
     * @param query - The analytics query definition
     * @returns Query results with rows and field metadata
     */
    query(query: AnalyticsQuery): Promise<AnalyticsResult>;

    /**
     * Get available cube metadata for discovery
     * @param cubeName - Optional cube name to filter (returns all if omitted)
     * @returns Array of cube metadata definitions
     */
    getMeta(cubeName?: string): Promise<CubeMeta[]>;

    /**
     * Generate SQL for a query without executing it (dry-run)
     * @param query - The analytics query definition
     * @returns Generated SQL string and parameters
     */
    generateSql?(query: AnalyticsQuery): Promise<{ sql: string; params: unknown[] }>;
}

// ==========================================
// Strategy Pattern Contracts
// ==========================================

/**
 * Driver capability descriptor.
 *
 * Used by the strategy chain to decide at runtime which execution path
 * is available for a given cube / object.
 */
export interface DriverCapabilities {
    /** Driver supports native SQL execution (e.g. Postgres, MySQL, SQLite). */
    nativeSql: boolean;
    /** Driver supports ObjectQL aggregate() operations. */
    objectqlAggregate: boolean;
    /** Driver is an in-memory implementation (dev/test only). */
    inMemory: boolean;
}

/**
 * Context passed to every strategy so it can access shared infrastructure.
 */
export interface StrategyContext {
    /** Resolve a cube definition by name. */
    getCube(name: string): Cube | undefined;
    /** Probe driver capabilities for the object backing a cube. */
    queryCapabilities(cubeName: string): DriverCapabilities;
    /**
     * Execute a raw SQL string on the driver that owns `objectName`.
     * Only available when `nativeSql` capability is true.
     */
    executeRawSql?(objectName: string, sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
    /**
     * Execute an ObjectQL aggregate query.
     * Only available when `objectqlAggregate` capability is true.
     */
    executeAggregate?(objectName: string, options: {
        groupBy?: string[];
        aggregations?: Array<{ field: string; method: string; alias: string }>;
        filter?: Record<string, unknown>;
    }): Promise<Record<string, unknown>[]>;
    /**
     * Fallback in-memory analytics service (e.g. MemoryAnalyticsService from driver-memory).
     */
    fallbackService?: {
        query(query: AnalyticsQuery): Promise<AnalyticsResult>;
        getMeta(cubeName?: string): Promise<CubeMeta[]>;
        generateSql?(query: AnalyticsQuery): Promise<{ sql: string; params: unknown[] }>;
    };
}

/**
 * AnalyticsStrategy — One link in the priority-ordered strategy chain.
 *
 * Each strategy is responsible for:
 * 1. Determining whether it *can* handle a query (via `canHandle`).
 * 2. Executing the query using its specific driver path.
 * 3. Optionally generating a SQL representation of the query.
 */
export interface AnalyticsStrategy {
    /** Human-readable strategy name (e.g. 'NativeSQLStrategy'). */
    readonly name: string;
    /** Priority (lower = higher priority). P1=10, P2=20, P3=30. */
    readonly priority: number;

    /**
     * Return `true` if this strategy can handle the given query in the
     * current runtime context (driver capabilities, cube availability, etc.).
     */
    canHandle(query: AnalyticsQuery, ctx: StrategyContext): boolean;

    /**
     * Execute the analytical query.
     * Called only when `canHandle` returned `true`.
     */
    execute(query: AnalyticsQuery, ctx: StrategyContext): Promise<AnalyticsResult>;

    /**
     * Generate a SQL representation without executing.
     * Called only when `canHandle` returned `true`.
     */
    generateSql(query: AnalyticsQuery, ctx: StrategyContext): Promise<{ sql: string; params: unknown[] }>;
}
