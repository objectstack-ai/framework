// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { AnalyticsQuery, AnalyticsResult } from '@objectstack/spec/contracts';
import type { Cube } from '@objectstack/spec/data';
import type { AnalyticsStrategy, StrategyContext } from './types.js';

/**
 * NativeSQLStrategy — Priority 1
 *
 * Pushes the analytics query down to the database as a native SQL statement.
 * This is the most efficient path and is preferred whenever the backing driver
 * supports raw SQL execution (e.g. Postgres, MySQL, SQLite).
 */
export class NativeSQLStrategy implements AnalyticsStrategy {
  readonly name = 'NativeSQLStrategy';
  readonly priority = 10;

  canHandle(query: AnalyticsQuery, ctx: StrategyContext): boolean {
    if (!query.cube) return false;
    const caps = ctx.queryCapabilities(query.cube);
    return caps.nativeSql && typeof ctx.executeRawSql === 'function';
  }

  async execute(query: AnalyticsQuery, ctx: StrategyContext): Promise<AnalyticsResult> {
    const { sql, params } = await this.generateSql(query, ctx);
    const cube = ctx.getCube(query.cube!)!;
    const objectName = this.extractObjectName(cube);

    const rows = await ctx.executeRawSql!(objectName, sql, params);

    // Build field metadata
    const fields = this.buildFieldMeta(query, cube);

    return { rows, fields, sql };
  }

  async generateSql(query: AnalyticsQuery, ctx: StrategyContext): Promise<{ sql: string; params: unknown[] }> {
    const cube = ctx.getCube(query.cube!);
    if (!cube) {
      throw new Error(`Cube not found: ${query.cube}`);
    }

    const params: unknown[] = [];
    const selectClauses: string[] = [];
    const groupByClauses: string[] = [];

    // Build SELECT for dimensions
    if (query.dimensions && query.dimensions.length > 0) {
      for (const dim of query.dimensions) {
        const colExpr = this.resolveDimensionSql(cube, dim);
        selectClauses.push(`${colExpr} AS "${dim}"`);
        groupByClauses.push(colExpr);
      }
    }

    // Build SELECT for measures
    if (query.measures && query.measures.length > 0) {
      for (const measure of query.measures) {
        const aggExpr = this.resolveMeasureSql(cube, measure);
        selectClauses.push(`${aggExpr} AS "${measure}"`);
      }
    }

    // Build WHERE clause
    const whereClauses: string[] = [];
    if (query.filters && query.filters.length > 0) {
      for (const filter of query.filters) {
        const colExpr = this.resolveFieldSql(cube, filter.member);
        const clause = this.buildFilterClause(colExpr, filter.operator, filter.values, params);
        if (clause) whereClauses.push(clause);
      }
    }

    // Build time dimension filters
    if (query.timeDimensions && query.timeDimensions.length > 0) {
      for (const td of query.timeDimensions) {
        const colExpr = this.resolveFieldSql(cube, td.dimension);
        if (td.dateRange) {
          const range = Array.isArray(td.dateRange) ? td.dateRange : [td.dateRange, td.dateRange];
          if (range.length === 2) {
            params.push(range[0], range[1]);
            whereClauses.push(`${colExpr} BETWEEN $${params.length - 1} AND $${params.length}`);
          }
        }
      }
    }

    const tableName = this.extractObjectName(cube);
    let sql = `SELECT ${selectClauses.join(', ')} FROM "${tableName}"`;
    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    if (groupByClauses.length > 0) {
      sql += ` GROUP BY ${groupByClauses.join(', ')}`;
    }
    if (query.order && Object.keys(query.order).length > 0) {
      const orderClauses = Object.entries(query.order).map(([f, d]) => `"${f}" ${d.toUpperCase()}`);
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }
    if (query.limit != null) {
      sql += ` LIMIT ${query.limit}`;
    }
    if (query.offset != null) {
      sql += ` OFFSET ${query.offset}`;
    }

    return { sql, params };
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private resolveDimensionSql(cube: Cube, member: string): string {
    const fieldName = member.includes('.') ? member.split('.')[1] : member;
    const dim = cube.dimensions[fieldName];
    return dim ? dim.sql : fieldName;
  }

  private resolveMeasureSql(cube: Cube, member: string): string {
    const fieldName = member.includes('.') ? member.split('.')[1] : member;
    const measure = cube.measures[fieldName];
    if (!measure) return `COUNT(*)`;

    const col = measure.sql;
    switch (measure.type) {
      case 'count': return 'COUNT(*)';
      case 'sum': return `SUM(${col})`;
      case 'avg': return `AVG(${col})`;
      case 'min': return `MIN(${col})`;
      case 'max': return `MAX(${col})`;
      case 'count_distinct': return `COUNT(DISTINCT ${col})`;
      default: return `COUNT(*)`;
    }
  }

  private resolveFieldSql(cube: Cube, member: string): string {
    const fieldName = member.includes('.') ? member.split('.')[1] : member;
    const dim = cube.dimensions[fieldName];
    if (dim) return dim.sql;
    const measure = cube.measures[fieldName];
    if (measure) return measure.sql;
    return fieldName;
  }

  private buildFilterClause(col: string, operator: string, values: string[] | undefined, params: unknown[]): string | null {
    const opMap: Record<string, string> = {
      equals: '=', notEquals: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
      contains: 'LIKE', notContains: 'NOT LIKE',
    };

    if (operator === 'set') return `${col} IS NOT NULL`;
    if (operator === 'notSet') return `${col} IS NULL`;

    const sqlOp = opMap[operator];
    if (!sqlOp || !values || values.length === 0) return null;

    if (operator === 'contains' || operator === 'notContains') {
      params.push(`%${values[0]}%`);
    } else {
      params.push(values[0]);
    }
    return `${col} ${sqlOp} $${params.length}`;
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
