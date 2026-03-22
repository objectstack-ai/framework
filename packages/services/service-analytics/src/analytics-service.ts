// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  IAnalyticsService,
  AnalyticsQuery,
  AnalyticsResult,
  CubeMeta,
} from '@objectstack/spec/contracts';
import type { Cube } from '@objectstack/spec/data';
import type { Logger } from '@objectstack/spec/contracts';
import { createLogger } from '@objectstack/core';
import { CubeRegistry } from './cube-registry.js';
import type { AnalyticsStrategy, DriverCapabilities, StrategyContext } from './strategies/types.js';
import { NativeSQLStrategy } from './strategies/native-sql-strategy.js';
import { ObjectQLStrategy } from './strategies/objectql-strategy.js';

/**
 * Configuration for AnalyticsService.
 */
export interface AnalyticsServiceConfig {
  /** Pre-defined cube definitions (from manifest). */
  cubes?: Cube[];
  /** Logger instance. */
  logger?: Logger;
  /**
   * Probe driver capabilities for the object that backs a cube.
   * The service calls this function to decide which strategy can handle a query.
   */
  queryCapabilities?: (cubeName: string) => DriverCapabilities;
  /**
   * Execute raw SQL on the driver for a given object.
   * Required for NativeSQLStrategy.
   */
  executeRawSql?: (objectName: string, sql: string, params: unknown[]) => Promise<Record<string, unknown>[]>;
  /**
   * Execute an ObjectQL aggregate query.
   * Required for ObjectQLStrategy.
   */
  executeAggregate?: (objectName: string, options: {
    groupBy?: string[];
    aggregations?: Array<{ field: string; method: string; alias: string }>;
    filter?: Record<string, unknown>;
  }) => Promise<Record<string, unknown>[]>;
  /**
   * Fallback IAnalyticsService (e.g. MemoryAnalyticsService).
   * Used by InMemoryStrategy.
   */
  fallbackService?: IAnalyticsService;
  /**
   * Custom strategies to add/replace the defaults.
   * They are merged with the built-in strategies and sorted by priority.
   */
  strategies?: AnalyticsStrategy[];
}

/**
 * Default capabilities when probing is not configured — assumes in-memory only.
 */
const DEFAULT_CAPABILITIES: DriverCapabilities = {
  nativeSql: false,
  objectqlAggregate: false,
  inMemory: true,
};

/**
 * AnalyticsService — Multi-driver analytics orchestrator.
 *
 * Implements `IAnalyticsService` by delegating to a priority-ordered
 * strategy chain:
 *
 * | Priority | Strategy | Condition |
 * |:---:|:---|:---|
 * | P1 (10) | NativeSQLStrategy | Driver supports raw SQL |
 * | P2 (20) | ObjectQLStrategy | Driver supports aggregate AST |
 * | P3 (30) | (custom / InMemoryStrategy from driver-memory) | Injected by user |
 *
 * When `fallbackService` is configured, an internal delegate strategy
 * is automatically appended at priority 30 as a safety net.
 *
 * The service also owns a `CubeRegistry` for metadata discovery and
 * auto-inference from object schemas.
 */
export class AnalyticsService implements IAnalyticsService {
  private readonly strategies: AnalyticsStrategy[];
  private readonly strategyCtx: StrategyContext;
  readonly cubeRegistry: CubeRegistry;
  private readonly logger: Logger;

  constructor(config: AnalyticsServiceConfig = {}) {
    this.logger = config.logger || createLogger({ level: 'info', format: 'pretty' });
    this.cubeRegistry = new CubeRegistry();

    // Register pre-defined cubes
    if (config.cubes) {
      this.cubeRegistry.registerAll(config.cubes);
    }

    // Build strategy context
    this.strategyCtx = {
      getCube: (name) => this.cubeRegistry.get(name),
      queryCapabilities: config.queryCapabilities || (() => DEFAULT_CAPABILITIES),
      executeRawSql: config.executeRawSql,
      executeAggregate: config.executeAggregate,
      fallbackService: config.fallbackService,
    };

    // Build strategy chain (built-in + custom, sorted by priority)
    // InMemoryStrategy is NOT built-in — it lives in @objectstack/driver-memory
    // and should be passed via config.strategies when needed.
    // When fallbackService is configured, an internal delegate is added at P3.
    const builtIn: AnalyticsStrategy[] = [
      new NativeSQLStrategy(),
      new ObjectQLStrategy(),
    ];

    // Auto-add fallback delegate when fallbackService is provided
    if (config.fallbackService) {
      builtIn.push(new FallbackDelegateStrategy());
    }

    const custom = config.strategies || [];
    this.strategies = [...builtIn, ...custom].sort((a, b) => a.priority - b.priority);

    this.logger.info(
      `[Analytics] Initialized with ${this.cubeRegistry.size} cubes, ` +
      `${this.strategies.length} strategies: ${this.strategies.map(s => s.name).join(' → ')}`,
    );
  }

  /**
   * Execute an analytical query by delegating to the first capable strategy.
   */
  async query(query: AnalyticsQuery): Promise<AnalyticsResult> {
    if (!query.cube) {
      throw new Error('Cube name is required in analytics query');
    }

    const strategy = this.resolveStrategy(query);
    this.logger.debug(`[Analytics] Query on cube "${query.cube}" → ${strategy.name}`);

    return strategy.execute(query, this.strategyCtx);
  }

  /**
   * Get cube metadata for discovery.
   */
  async getMeta(cubeName?: string): Promise<CubeMeta[]> {
    // If a fallback service is configured, merge its metadata with the registry
    const cubes = cubeName
      ? [this.cubeRegistry.get(cubeName)].filter(Boolean) as Cube[]
      : this.cubeRegistry.getAll();

    return cubes.map(cube => ({
      name: cube.name,
      title: cube.title,
      measures: Object.entries(cube.measures).map(([key, measure]) => ({
        name: `${cube.name}.${key}`,
        type: measure.type,
        title: measure.label,
      })),
      dimensions: Object.entries(cube.dimensions).map(([key, dimension]) => ({
        name: `${cube.name}.${key}`,
        type: dimension.type,
        title: dimension.label,
      })),
    }));
  }

  /**
   * Generate SQL for a query without executing it (dry-run).
   */
  async generateSql(query: AnalyticsQuery): Promise<{ sql: string; params: unknown[] }> {
    if (!query.cube) {
      throw new Error('Cube name is required for SQL generation');
    }

    const strategy = this.resolveStrategy(query);
    this.logger.debug(`[Analytics] generateSql on cube "${query.cube}" → ${strategy.name}`);

    return strategy.generateSql(query, this.strategyCtx);
  }

  // ── Internal ─────────────────────────────────────────────────────

  /**
   * Walk the strategy chain and return the first strategy that can handle the query.
   */
  private resolveStrategy(query: AnalyticsQuery): AnalyticsStrategy {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(query, this.strategyCtx)) {
        return strategy;
      }
    }
    throw new Error(
      `[Analytics] No strategy can handle query for cube "${query.cube}". ` +
      `Checked: ${this.strategies.map(s => s.name).join(', ')}. ` +
      'Ensure a compatible driver is configured or a fallback service is registered.',
    );
  }
}

/**
 * FallbackDelegateStrategy — Internal strategy for fallback service delegation.
 *
 * Automatically added to the strategy chain when `fallbackService` is configured.
 * Not exported — consumers who need explicit in-memory support should use
 * `InMemoryStrategy` from `@objectstack/driver-memory`.
 */
class FallbackDelegateStrategy implements AnalyticsStrategy {
  readonly name = 'FallbackDelegateStrategy';
  readonly priority = 30;

  canHandle(query: AnalyticsQuery, ctx: StrategyContext): boolean {
    if (!query.cube) return false;
    return !!ctx.fallbackService;
  }

  async execute(query: AnalyticsQuery, ctx: StrategyContext): Promise<AnalyticsResult> {
    return ctx.fallbackService!.query(query);
  }

  async generateSql(query: AnalyticsQuery, ctx: StrategyContext): Promise<{ sql: string; params: unknown[] }> {
    if (ctx.fallbackService?.generateSql) {
      return ctx.fallbackService.generateSql(query);
    }
    return {
      sql: `-- FallbackDelegateStrategy: SQL generation not supported for cube "${query.cube}"`,
      params: [],
    };
  }
}
