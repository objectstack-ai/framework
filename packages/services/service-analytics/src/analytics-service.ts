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

    const normalized = this.normalizeQuery(query);
    this.ensureCube(normalized);
    const strategy = this.resolveStrategy(normalized);
    this.logger.debug(`[Analytics] Query on cube "${normalized.cube}" → ${strategy.name}`);

    return strategy.execute(normalized, this.strategyCtx);
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

    const normalized = this.normalizeQuery(query);
    this.ensureCube(normalized);
    const strategy = this.resolveStrategy(normalized);
    this.logger.debug(`[Analytics] generateSql on cube "${normalized.cube}" → ${strategy.name}`);

    return strategy.generateSql(normalized, this.strategyCtx);
  }

  // ── Internal ─────────────────────────────────────────────────────

  /**
   * Normalise a query into a canonical shape that strategies can rely on:
   *
   * 1. **Filters as object** — Some clients (e.g. dashboard widget translators)
   *    send `filters` as a Mongo-style object `{ stage: { $nin: [...] } }`
   *    instead of the schema's `Array<{ member, operator, values }>`. We
   *    translate the object form into the array form so existing strategies
   *    work unchanged.
   * 2. Other shapes are returned as-is.
   */
  private normalizeQuery(query: AnalyticsQuery): AnalyticsQuery {
    const filters = query.filters as unknown;
    if (!filters || Array.isArray(filters)) return query;
    if (typeof filters !== 'object') return query;

    const arr: AnalyticsQuery['filters'] = [];
    for (const [member, raw] of Object.entries(filters as Record<string, unknown>)) {
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && !(raw instanceof Date)) {
        for (const [op, val] of Object.entries(raw as Record<string, unknown>)) {
          const mapped = mongoOperatorToFilter(op, val);
          if (!mapped) continue;
          if (mapped.multi) {
            arr.push({ member, operator: mapped.operator, values: mapped.values });
          } else if (mapped.values.length === 0) {
            arr.push({ member, operator: mapped.operator, values: [] });
          } else {
            for (const v of mapped.values) arr.push({ member, operator: mapped.operator, values: [v] });
          }
        }
      } else if (Array.isArray(raw)) {
        arr.push({ member, operator: 'in', values: raw.map(String) });
      } else {
        arr.push({ member, operator: 'equals', values: [String(raw)] });
      }
    }
    return { ...query, filters: arr };
  }

  /**
   * Ensure a cube exists for the given query and that it knows about every
   * measure referenced by the query.
   *
   * - If no cube is registered for `query.cube`, infer a minimal cube from
   *   the query so downstream strategies (which assume `cube.sql` exists)
   *   don't crash.
   * - If a cube exists but the query references measures that aren't in
   *   `cube.measures` (e.g. `amount_sum`, `amount_avg` emitted by dashboard
   *   widget translators), inject suffix-inferred Metric entries so the
   *   strategies pick the right aggregation function and field.
   */
  private ensureCube(query: AnalyticsQuery): void {
    const name = query.cube!;
    let cube = this.cubeRegistry.get(name);

    if (!cube) {
      cube = this.inferCubeFromQuery(query);
      this.cubeRegistry.register(cube);
      this.logger.warn(
        `[Analytics] No cube registered for "${name}"; auto-inferred a minimal cube ` +
        `(sql="${name}", measures=${Object.keys(cube.measures).join(',') || '(none)'}, ` +
        `dimensions=${Object.keys(cube.dimensions).join(',') || '(none)'}). ` +
        `Define an explicit Cube in your stack for full control.`,
      );
      return;
    }

    // Cube exists — check for unknown measures referenced by the query and
    // augment the cube with suffix-inferred Metric definitions so callers
    // that pass `<field>_sum` / `<field>_avg` etc. get the right aggregation.
    const stripPrefix = (m: string) => (m.includes('.') ? m.split('.').slice(1).join('.') : m);
    const extraMeasures: Record<string, any> = {};
    for (const m of query.measures || []) {
      const key = stripPrefix(m);
      if (cube.measures[key] || extraMeasures[key]) continue;
      extraMeasures[key] = inferMeasure(key);
    }
    if (Object.keys(extraMeasures).length > 0) {
      const augmented: Cube = {
        ...cube,
        measures: { ...cube.measures, ...extraMeasures },
      };
      this.cubeRegistry.register(augmented);
      this.logger.debug(
        `[Analytics] Augmented cube "${name}" with inferred measures: ${Object.keys(extraMeasures).join(',')}`,
      );
    }
  }

  /** Build a minimal Cube from the fields referenced by an AnalyticsQuery. */
  private inferCubeFromQuery(query: AnalyticsQuery): Cube {
    const cubeName = query.cube!;
    const measures: Record<string, any> = {};
    const dimensions: Record<string, any> = {};

    const stripPrefix = (m: string) => (m.includes('.') ? m.split('.').slice(1).join('.') : m);

    // Always provide a default `count` measure
    measures.count = { name: 'count', label: 'Count', type: 'count', sql: '*' };

    for (const m of query.measures || []) {
      const key = stripPrefix(m);
      if (measures[key]) continue;
      const inferred = inferMeasure(key);
      measures[key] = inferred;
    }

    for (const d of query.dimensions || []) {
      const key = stripPrefix(d);
      if (dimensions[key]) continue;
      dimensions[key] = { name: key, label: key, type: 'string', sql: key };
    }

    if (Array.isArray(query.filters)) {
      for (const f of query.filters) {
        const key = stripPrefix(f.member);
        if (dimensions[key] || measures[key]) continue;
        dimensions[key] = { name: key, label: key, type: 'string', sql: key };
      }
    }

    if (query.where && typeof query.where === 'object' && !Array.isArray(query.where)) {
      // Canonical FilterCondition: top-level keys (excluding logical
      // combinators) are field names. We only need them to seed an
      // ad-hoc cube definition for free-form queries.
      for (const key of Object.keys(query.where as Record<string, unknown>)) {
        if (key.startsWith('$')) continue;
        const stripped = stripPrefix(key);
        if (dimensions[stripped] || measures[stripped]) continue;
        dimensions[stripped] = { name: stripped, label: stripped, type: 'string', sql: stripped };
      }
    }

    for (const td of query.timeDimensions || []) {
      const key = stripPrefix(td.dimension);
      if (dimensions[key]) continue;
      dimensions[key] = {
        name: key, label: key, type: 'time', sql: key,
        granularities: ['day', 'week', 'month', 'quarter', 'year'],
      };
    }

    return {
      name: cubeName,
      title: cubeName,
      sql: cubeName,
      measures,
      dimensions,
      public: false,
    };
  }

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
 * Infer a Metric definition from a measure key name.
 *
 * Recognised suffix conventions (matches dashboard widget translators that
 * emit measures like `<field>_sum`, `<field>_avg`):
 *
 * | Suffix             | Aggregation     |
 * |:-------------------|:----------------|
 * | `count`            | `count(*)`      |
 * | `_sum`             | `sum(field)`    |
 * | `_avg` / `_average`| `avg(field)`   |
 * | `_min`             | `min(field)`    |
 * | `_max`             | `max(field)`    |
 * | `_count_distinct`  | `count(distinct field)` |
 *
 * Anything else is treated as a `sum(<key>)` — best-effort default for an
 * unknown numeric measure.
 */
export function inferMeasure(key: string): { name: string; label: string; type: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'count_distinct'; sql: string } {
  if (key === 'count') {
    return { name: 'count', label: 'Count', type: 'count', sql: '*' };
  }
  const suffixes: Array<[string, 'sum' | 'avg' | 'min' | 'max' | 'count_distinct']> = [
    ['_count_distinct', 'count_distinct'],
    ['_sum', 'sum'],
    ['_avg', 'avg'],
    ['_average', 'avg'],
    ['_min', 'min'],
    ['_max', 'max'],
  ];
  for (const [suffix, type] of suffixes) {
    if (key.endsWith(suffix)) {
      const field = key.slice(0, -suffix.length) || '*';
      return { name: key, label: key, type, sql: field };
    }
  }
  return { name: key, label: key, type: 'sum', sql: key };
}

/**
 * Translate a Mongo-style filter operator (e.g. `$gte`, `$nin`, `$regex`)
 * into the AnalyticsQuery filter shape (`operator` + flat `values` array).
 *
 * Multi-value Mongo operators (`$in`, `$nin`) are returned as a single
 * filter clause with multiple values — the calling normaliser splits them
 * into one filter per value so downstream strategies that take `values[0]`
 * still produce the correct AND-combined SQL (`col != $1 AND col != $2`).
 *
 * Returns `null` when the operator can't be safely represented (e.g.
 * unsupported complex operators).
 */
function mongoOperatorToFilter(
  op: string,
  val: unknown,
): { operator: 'equals' | 'notEquals' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'notContains' | 'in' | 'notIn' | 'set' | 'notSet' | 'inDateRange'; values: string[]; multi?: boolean } | null {
  const toStrArr = (v: unknown): string[] =>
    v == null ? [] : Array.isArray(v) ? v.map(String) : [String(v)];
  switch (op) {
    case '$eq':       return { operator: 'equals', values: toStrArr(val) };
    case '$ne':       return { operator: 'notEquals', values: toStrArr(val) };
    case '$gt':       return { operator: 'gt', values: toStrArr(val) };
    case '$gte':      return { operator: 'gte', values: toStrArr(val) };
    case '$lt':       return { operator: 'lt', values: toStrArr(val) };
    case '$lte':      return { operator: 'lte', values: toStrArr(val) };
    case '$in':       return { operator: 'in', values: toStrArr(val), multi: true };
    case '$nin':      return { operator: 'notIn', values: toStrArr(val), multi: true };
    case '$regex':    return { operator: 'contains', values: toStrArr(val) };
    case '$exists':   return val ? { operator: 'set', values: [] } : { operator: 'notSet', values: [] };
    default:          return null;
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
