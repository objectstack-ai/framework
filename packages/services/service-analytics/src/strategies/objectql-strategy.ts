// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { AnalyticsQuery, AnalyticsResult } from '@objectstack/spec/contracts';
import type { Cube } from '@objectstack/spec/data';
import type { AnalyticsStrategy, StrategyContext } from './types.js';

/**
 * ObjectQLStrategy — Priority 2
 *
 * Translates an analytics query into an ObjectQL `engine.aggregate()` call.
 * This path works with any driver that supports the ObjectQL aggregate AST
 * (Postgres, Mongo, SQLite, etc.) without requiring raw SQL access.
 */
export class ObjectQLStrategy implements AnalyticsStrategy {
  readonly name = 'ObjectQLStrategy';
  readonly priority = 20;

  canHandle(query: AnalyticsQuery, ctx: StrategyContext): boolean {
    if (!query.cube) return false;
    const caps = ctx.queryCapabilities(query.cube);
    return caps.objectqlAggregate && typeof ctx.executeAggregate === 'function';
  }

  async execute(query: AnalyticsQuery, ctx: StrategyContext): Promise<AnalyticsResult> {
    const cube = ctx.getCube(query.cube!)!;
    const objectName = this.extractObjectName(cube);

    // Build groupBy from dimensions
    const groupBy: string[] = [];
    if (query.dimensions && query.dimensions.length > 0) {
      for (const dim of query.dimensions) {
        groupBy.push(this.resolveFieldName(cube, dim, 'dimension'));
      }
    }

    // Build aggregations from measures
    const aggregations: Array<{ field: string; method: string; alias: string }> = [];
    if (query.measures && query.measures.length > 0) {
      for (const measure of query.measures) {
        const { field, method } = this.resolveMeasureAggregation(cube, measure);
        aggregations.push({ field, method, alias: measure });
      }
    }

    // Build filter from query filters
    const filter: Record<string, unknown> = {};
    if (query.filters && query.filters.length > 0) {
      for (const f of query.filters) {
        const fieldName = this.resolveFieldName(cube, f.member, 'any');
        filter[fieldName] = this.convertFilter(f.operator, f.values);
      }
    }

    const rows = await ctx.executeAggregate!(objectName, {
      groupBy: groupBy.length > 0 ? groupBy : undefined,
      aggregations: aggregations.length > 0 ? aggregations : undefined,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    // Remap short field names back to cube-qualified names
    const mappedRows = rows.map(row => {
      const mapped: Record<string, unknown> = {};
      if (query.dimensions) {
        for (const dim of query.dimensions) {
          const shortName = this.resolveFieldName(cube, dim, 'dimension');
          if (shortName in row) mapped[dim] = row[shortName];
        }
      }
      if (query.measures) {
        for (const m of query.measures) {
          // Alias was set to the full measure name
          if (m in row) mapped[m] = row[m];
        }
      }
      return mapped;
    });

    const fields = this.buildFieldMeta(query, cube);
    return { rows: mappedRows, fields };
  }

  async generateSql(query: AnalyticsQuery, ctx: StrategyContext): Promise<{ sql: string; params: unknown[] }> {
    const cube = ctx.getCube(query.cube!);
    if (!cube) {
      throw new Error(`Cube not found: ${query.cube}`);
    }

    // Generate a representative SQL even though ObjectQL uses AST internally
    const selectParts: string[] = [];
    const groupByParts: string[] = [];

    if (query.dimensions) {
      for (const dim of query.dimensions) {
        const col = this.resolveFieldName(cube, dim, 'dimension');
        selectParts.push(`${col} AS "${dim}"`);
        groupByParts.push(col);
      }
    }
    if (query.measures) {
      for (const m of query.measures) {
        const { field, method } = this.resolveMeasureAggregation(cube, m);
        const aggSql = method === 'count' ? 'COUNT(*)' : `${method.toUpperCase()}(${field})`;
        selectParts.push(`${aggSql} AS "${m}"`);
      }
    }

    const tableName = this.extractObjectName(cube);
    let sql = `SELECT ${selectParts.join(', ')} FROM "${tableName}"`;
    if (groupByParts.length > 0) {
      sql += ` GROUP BY ${groupByParts.join(', ')}`;
    }

    return { sql, params: [] };
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private resolveFieldName(cube: Cube, member: string, kind: 'dimension' | 'measure' | 'any'): string {
    const fieldName = member.includes('.') ? member.split('.')[1] : member;
    if (kind === 'dimension' || kind === 'any') {
      const dim = cube.dimensions[fieldName];
      if (dim) return dim.sql.replace(/^\$/, '');
    }
    if (kind === 'measure' || kind === 'any') {
      const measure = cube.measures[fieldName];
      if (measure) return measure.sql.replace(/^\$/, '');
    }
    return fieldName;
  }

  private resolveMeasureAggregation(cube: Cube, measureName: string): { field: string; method: string } {
    const fieldName = measureName.includes('.') ? measureName.split('.')[1] : measureName;
    const measure = cube.measures[fieldName];
    if (!measure) return { field: '*', method: 'count' };
    return {
      field: measure.sql.replace(/^\$/, ''),
      method: measure.type === 'count_distinct' ? 'count_distinct' : measure.type,
    };
  }

  private convertFilter(operator: string, values?: string[]): unknown {
    if (operator === 'set') return { $ne: null };
    if (operator === 'notSet') return null;
    if (!values || values.length === 0) return undefined;

    switch (operator) {
      case 'equals': return values[0];
      case 'notEquals': return { $ne: values[0] };
      case 'gt': return { $gt: values[0] };
      case 'gte': return { $gte: values[0] };
      case 'lt': return { $lt: values[0] };
      case 'lte': return { $lte: values[0] };
      case 'contains': return { $regex: values[0] };
      default: return values[0];
    }
  }

  private extractObjectName(cube: Cube): string {
    return cube.sql.trim();
  }

  private buildFieldMeta(query: AnalyticsQuery, cube: Cube): Array<{ name: string; type: string }> {
    const fields: Array<{ name: string; type: string }> = [];
    if (query.dimensions) {
      for (const dim of query.dimensions) {
        const fieldName = dim.includes('.') ? dim.split('.')[1] : dim;
        const d = cube.dimensions[fieldName];
        fields.push({ name: dim, type: d?.type || 'string' });
      }
    }
    if (query.measures) {
      for (const m of query.measures) {
        fields.push({ name: m, type: 'number' });
      }
    }
    return fields;
  }
}
