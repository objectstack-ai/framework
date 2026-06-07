// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { AnalyticsQuery, AnalyticsResult } from '@objectstack/spec/contracts';
import type { Cube } from '@objectstack/spec/data';
import type { AnalyticsStrategy, StrategyContext } from './types.js';
import { normalizeAnalyticsFilters, coerceFilterValueForSql } from './filter-normalizer.js';
import { compileScopedFilterToSql } from '../read-scope-sql.js';

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
    const tableName = this.extractObjectName(cube);
    // Map of relation alias → JOIN clause. Populated lazily as dotted
    // dimensions/measures/filters are resolved.
    const joins = new Map<string, string>();

    // Build SELECT for dimensions
    if (query.dimensions && query.dimensions.length > 0) {
      for (const dim of query.dimensions) {
        const colExpr = this.resolveDimensionSql(cube, dim, tableName, joins);
        selectClauses.push(`${colExpr} AS "${dim}"`);
        groupByClauses.push(colExpr);
      }
    }

    // Build SELECT for measures
    if (query.measures && query.measures.length > 0) {
      for (const measure of query.measures) {
        const aggExpr = this.resolveMeasureSql(cube, measure, tableName, joins);
        selectClauses.push(`${aggExpr} AS "${measure}"`);
      }
    }

    // Build WHERE clause
    const whereClauses: string[] = [];
    const normalizedFilters = normalizeAnalyticsFilters(query);
    if (normalizedFilters.length > 0) {
      for (const filter of normalizedFilters) {
        const colExpr = this.resolveFieldSql(cube, filter.member, tableName, joins);
        const clause = this.buildFilterClause(colExpr, filter.operator, filter.values, params);
        if (clause) whereClauses.push(clause);
      }
    }

    // Build time dimension filters
    if (query.timeDimensions && query.timeDimensions.length > 0) {
      for (const td of query.timeDimensions) {
        const colExpr = this.resolveFieldSql(cube, td.dimension, tableName, joins);
        if (td.dateRange) {
          const range = Array.isArray(td.dateRange) ? td.dateRange : [td.dateRange, td.dateRange];
          if (range.length === 2) {
            params.push(range[0], range[1]);
            whereClauses.push(`${colExpr} BETWEEN $${params.length - 1} AND $${params.length}`);
          }
        }
      }
    }

    // ── ADR-0021 D-C — enforce the join allowlist + inject per-object RLS ──
    // 1. Reject any join not backed by a relationship the dataset declared.
    const allowed = ctx.getAllowedRelationships?.(query.cube!);
    if (allowed) {
      for (const alias of joins.keys()) {
        if (!allowed.has(alias)) {
          throw new Error(
            `[NativeSQLStrategy] join "${alias}" is not backed by a declared relationship on ` +
            `cube "${query.cube}". v1 only joins along relationships listed in the dataset's \`include\`.`,
          );
        }
      }
    }
    // 2. Inject the tenant/RLS read scope for the base table AND every joined
    //    object — this is the predicate the raw-SQL path would otherwise skip.
    this.applyReadScope(this.extractObjectName(cube), tableName, ctx, whereClauses, params);
    for (const alias of joins.keys()) {
      // The joined OBJECT (for the RLS lookup) is the target table from the
      // cube's join map; the ALIAS is how it's referenced in SQL. These differ
      // for namespaced objects (alias `account` → object `crm_account`).
      const joinedObject = cube.joins?.[alias]?.name ?? alias;
      this.applyReadScope(joinedObject, alias, ctx, whereClauses, params);
    }

    let sql = `SELECT ${selectClauses.join(', ')} FROM "${tableName}"`;
    if (joins.size > 0) {
      sql += ' ' + Array.from(joins.values()).join(' ');
    }
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

  /**
   * ADR-0021 D-C — inject an object's read scope (tenant + RLS predicate) into
   * the WHERE clause. The scope is a canonical `FilterCondition` (what the
   * RLSCompiler emits); `compileScopedFilterToSql` turns it into alias-qualified,
   * parameterized SQL (fail-closed — it throws rather than drop a predicate).
   * The `?` placeholders are then renumbered into the strategy's `$N` scheme.
   * No-op when the runtime provides no scope hook (the caller is then
   * responsible for isolation — see contract note).
   */
  private applyReadScope(
    objectName: string,
    alias: string,
    ctx: StrategyContext,
    whereClauses: string[],
    params: unknown[],
  ): void {
    if (typeof ctx.getReadScope !== 'function') return;
    const filter = ctx.getReadScope(objectName);
    if (filter === undefined || filter === null) return;
    const { sql, params: scopeParams } = compileScopedFilterToSql(filter, alias);
    if (!sql) return;
    let i = 0;
    const rendered = sql.replace(/\?/g, () => {
      params.push(scopeParams[i++]);
      return `$${params.length}`;
    });
    whereClauses.push(`(${rendered})`);
  }

  /**
   * Resolve a dimension/measure/filter SQL expression that may reference a
   * related table via dot notation (e.g. `account.industry`).
   *
   * When the resolved `sql` contains a dot, treat the prefix as a lookup
   * field on the cube's table and synthesise a `LEFT JOIN` against the
   * related table. The convention (matching the auto-cube generator and
   * ObjectStack object schemas) is:
   *
   *   <parentTable>.<lookupField> = <lookupField>.id
   *
   * i.e. the lookup field name on the parent table equals the related
   * table name. This holds for all `Field.lookup({ object: '...' })`
   * declarations where the field is named after its target object.
   *
   * Returns the qualified SQL reference (e.g. `"account"."industry"`).
   * Pure column references (no dot) are returned as-is.
   */
  private qualifyAndRegisterJoin(
    rawSql: string,
    parentTable: string,
    joins: Map<string, string>,
    cube?: Cube,
  ): string {
    if (!rawSql.includes('.')) return rawSql;
    // Only the first dotted hop is supported (single-level relation).
    const [alias, ...rest] = rawSql.split('.');
    if (!alias || rest.length === 0) return rawSql;
    const column = rest.join('.');
    if (!joins.has(alias)) {
      // The relationship name is the join ALIAS; the joined TABLE is the
      // related object. For datasets these differ when objects are namespaced
      // (lookup `account` → table `crm_account`), so resolve the table from the
      // Cube's `joins` map (emitted by the dataset compiler). Fall back to the
      // alias as the table for legacy/same-name cubes.
      const joinTable = cube?.joins?.[alias]?.name ?? alias;
      // Only emit an explicit alias when the table differs from it; when they
      // match, `LEFT JOIN "account" ON …` is cleaner (and back-compat).
      const tableRef = joinTable === alias ? `"${alias}"` : `"${joinTable}" "${alias}"`;
      joins.set(
        alias,
        `LEFT JOIN ${tableRef} ON "${parentTable}"."${alias}" = "${alias}"."id"`,
      );
    }
    return `"${alias}"."${column}"`;
  }

  /**
   * Resolve a member reference (dimension, measure, or filter field) to its
   * cube definition.
   *
   * Accepts three naming conventions:
   *   1. `<cube>.<field>` — the canonical analytics qualifier (stripped to `<field>`).
   *   2. `<lookup>.<field>` — a relation traversal (e.g. `account.industry`).
   *      First tried as the literal key, then as the underscore-flattened
   *      key (`account_industry`), and finally returned as a synthetic
   *      definition whose `sql` is the dotted reference so the JOIN
   *      machinery can pick it up.
   *   3. `<field>` — a bare field name on the cube's table.
   */
  private lookupMember(
    cube: Cube,
    member: string,
    kind: 'dimension' | 'measure',
  ): { sql: string; type?: string } | undefined {
    const bag = kind === 'dimension' ? cube.dimensions : cube.measures;
    // Direct hit on the registered key (handles `cube.field` and exact dotted keys).
    if (bag[member]) return bag[member];
    if (member.includes('.')) {
      const [first, ...rest] = member.split('.');
      const tail = rest.join('.');
      // `<cube>.<field>` style.
      if (first === cube.name && bag[tail]) return bag[tail];
      // Plain second-segment lookup (legacy behaviour).
      if (bag[tail]) return bag[tail];
      // Underscore-flattened relation lookup (e.g. `account_industry`).
      const flat = member.replace(/\./g, '_');
      if (bag[flat]) return bag[flat];
      // Synthetic relation traversal — let qualifyAndRegisterJoin handle it.
      if (kind === 'dimension') {
        return { sql: member, type: 'string' };
      }
    } else if (bag[member]) {
      return bag[member];
    }
    return undefined;
  }

  private resolveDimensionSql(
    cube: Cube,
    member: string,
    parentTable: string,
    joins: Map<string, string>,
  ): string {
    const dim = this.lookupMember(cube, member, 'dimension');
    const raw = dim ? dim.sql : (member.includes('.') ? member.split('.')[1] : member);
    return this.qualifyAndRegisterJoin(raw, parentTable, joins, cube);
  }

  private resolveMeasureSql(
    cube: Cube,
    member: string,
    parentTable: string,
    joins: Map<string, string>,
  ): string {
    const measure = this.lookupMember(cube, member, 'measure') as
      | { sql: string; type: string }
      | undefined;
    if (!measure) return `COUNT(*)`;

    const col = measure.sql === '*'
      ? '*'
      : this.qualifyAndRegisterJoin(measure.sql, parentTable, joins, cube);
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

  private resolveFieldSql(
    cube: Cube,
    member: string,
    parentTable: string,
    joins: Map<string, string>,
  ): string {
    const dim = this.lookupMember(cube, member, 'dimension');
    if (dim) return this.qualifyAndRegisterJoin(dim.sql, parentTable, joins, cube);
    const measure = this.lookupMember(cube, member, 'measure');
    if (measure) return this.qualifyAndRegisterJoin(measure.sql, parentTable, joins, cube);
    const fieldName = member.includes('.') ? member.split('.')[1] : member;
    return fieldName;
  }

  private buildFilterClause(col: string, operator: string, values: string[] | undefined, params: unknown[]): string | null {
    const opMap: Record<string, string> = {
      equals: '=', notEquals: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
      contains: 'LIKE', notContains: 'NOT LIKE',
    };

    if (operator === 'set') return `${col} IS NOT NULL`;
    if (operator === 'notSet') return `${col} IS NULL`;

    if (operator === 'in' || operator === 'notIn') {
      if (!values || values.length === 0) return null;
      const placeholders = values.map(v => { params.push(coerceFilterValueForSql(v)); return `$${params.length}`; }).join(', ');
      return `${col} ${operator === 'in' ? 'IN' : 'NOT IN'} (${placeholders})`;
    }

    const sqlOp = opMap[operator];
    if (!sqlOp || !values || values.length === 0) return null;

    if (operator === 'contains' || operator === 'notContains') {
      params.push(`%${values[0]}%`);
    } else {
      // Coerce so booleans/numbers bind as their native SQL types
      // (avoids '1' (text) vs 1 (integer) mismatches against typed
      // boolean columns under SQLite/Postgres).
      params.push(coerceFilterValueForSql(values[0]));
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
        const d = this.lookupMember(cube, dim, 'dimension');
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
