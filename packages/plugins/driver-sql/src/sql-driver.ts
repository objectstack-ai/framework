// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * SQL Driver for ObjectStack
 *
 * Implements the standard IDataDriver from @objectstack/spec via Knex.js.
 * Supports PostgreSQL, MySQL, SQLite, and other SQL databases.
 */

import type { QueryAST, DriverOptions } from '@objectstack/spec/data';
import type { IDataDriver } from '@objectstack/spec/contracts';
import knex, { Knex } from 'knex';
import { nanoid } from 'nanoid';

/**
 * Default ID length for auto-generated IDs.
 */
const DEFAULT_ID_LENGTH = 16;

// ── Introspection Types ──────────────────────────────────────────────────────

export interface IntrospectedColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
  isPrimary?: boolean;
  isUnique?: boolean;
  maxLength?: number;
}

export interface IntrospectedForeignKey {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  constraintName?: string;
}

export interface IntrospectedTable {
  name: string;
  columns: IntrospectedColumn[];
  foreignKeys: IntrospectedForeignKey[];
  primaryKeys: string[];
}

export interface IntrospectedSchema {
  tables: Record<string, IntrospectedTable>;
}

// ── Configuration Types ──────────────────────────────────────────────────────

/**
 * SqlDriver configuration — passed directly to Knex.
 * See https://knexjs.org/guide/#configuration-options
 */
export type SqlDriverConfig = Knex.Config;

// ── SQL Driver ───────────────────────────────────────────────────────────────

/**
 * SQL Driver for ObjectStack.
 *
 * Implements the IDataDriver contract via Knex.js for optimal SQL
 * generation against PostgreSQL, MySQL, SQLite and other SQL databases.
 */
export class SqlDriver implements IDataDriver {
  // IDataDriver metadata
  public readonly name = 'com.objectstack.driver.sql';
  public readonly version = '1.0.0';
  public readonly supports = {
    // Basic CRUD Operations
    create: true,
    read: true,
    update: true,
    delete: true,

    // Bulk Operations
    bulkCreate: true,
    bulkUpdate: true,
    bulkDelete: true,

    // Transaction & Connection Management
    transactions: true,
    savepoints: false,

    // Query Operations
    queryFilters: true,
    queryAggregations: true,
    querySorting: true,
    queryPagination: true,
    queryWindowFunctions: true,
    querySubqueries: true,
    queryCTE: false,
    joins: true,

    // Advanced Features
    fullTextSearch: false,
    jsonQuery: false,
    geospatialQuery: false,
    streaming: false,
    jsonFields: true,
    arrayFields: true,
    vectorSearch: false,

    // Schema Management
    schemaSync: true,
    migrations: false,
    indexes: false,

    // Performance & Optimization
    connectionPooling: true,
    preparedStatements: true,
    queryCache: false,
  };

  protected knex: Knex;
  protected config: Knex.Config;
  protected jsonFields: Record<string, string[]> = {};
  protected booleanFields: Record<string, string[]> = {};
  protected tablesWithTimestamps: Set<string> = new Set();

  /** Whether the underlying database is a SQLite variant (sqlite3 or better-sqlite3). */
  protected get isSqlite(): boolean {
    const c = (this.config as any).client;
    return c === 'sqlite3' || c === 'better-sqlite3';
  }

  /** Whether the underlying database is PostgreSQL. */
  protected get isPostgres(): boolean {
    const c = (this.config as any).client;
    return c === 'pg' || c === 'postgresql';
  }

  /** Whether the underlying database is MySQL. */
  protected get isMysql(): boolean {
    const c = (this.config as any).client;
    return c === 'mysql' || c === 'mysql2';
  }

  constructor(config: SqlDriverConfig) {
    this.config = config;
    this.knex = knex(config);
  }

  // ===================================
  // Lifecycle
  // ===================================

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.knex.raw('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.knex.destroy();
  }

  // ===================================
  // CRUD — DriverInterface core
  // ===================================

  async find(object: string, query: QueryAST, options?: DriverOptions): Promise<any[]> {
    const builder = this.getBuilder(object, options);

    // SELECT
    if (query.fields) {
      builder.select((query.fields as string[]).map((f: string) => this.mapSortField(f)));
    } else {
      builder.select('*');
    }

    // WHERE
    if (query.where) {
      this.applyFilters(builder, query.where);
    }

    // ORDER BY
    if (query.orderBy && Array.isArray(query.orderBy)) {
      for (const item of query.orderBy) {
        const field = item.field || item[0];
        const dir = item.order || item[1] || 'asc';
        if (field) {
          builder.orderBy(this.mapSortField(field), dir);
        }
      }
    }

    // PAGINATION
    if (query.offset !== undefined) builder.offset(query.offset);
    if (query.limit !== undefined) builder.limit(query.limit);

    let results: any[];
    try {
      results = await builder;
    } catch (error: any) {
      if (
        error.message &&
        (error.message.includes('no such column') ||
          (error.message.includes('column') && error.message.includes('does not exist')))
      ) {
        return [];
      }
      throw error;
    }

    if (!Array.isArray(results)) {
      return [];
    }

    if (this.isSqlite) {
      for (const row of results) {
        this.formatOutput(object, row);
      }
    }
    return results;
  }

  async findOne(object: string, query: QueryAST, options?: DriverOptions): Promise<any> {
    // When called with a string/number id fall back gracefully
    if (typeof query === 'string' || typeof query === 'number') {
      const res = await this.getBuilder(object, options).where('id', query).first();
      return this.formatOutput(object, res) || null;
    }

    if (query && typeof query === 'object') {
      const results = await this.find(object, { ...query, limit: 1 }, options);
      return results[0] || null;
    }

    return null;
  }

  /**
   * Stream records matching a structured query.
   * NOTE: Current implementation fetches all results then yields them.
   * TODO: Use Knex .stream() for true cursor-based streaming on large datasets.
   */
  async *findStream(object: string, query: QueryAST, options?: DriverOptions): AsyncGenerator<Record<string, any>> {
    const results = await this.find(object, query, options);
    for (const row of results) {
      yield row;
    }
  }

  async create(object: string, data: Record<string, any>, options?: DriverOptions): Promise<any> {
    const { _id, ...rest } = data;
    const toInsert = { ...rest };

    if (_id !== undefined && toInsert.id === undefined) {
      toInsert.id = _id;
    } else if (toInsert.id === undefined) {
      toInsert.id = nanoid(DEFAULT_ID_LENGTH);
    }

    const builder = this.getBuilder(object, options);
    const formatted = this.formatInput(object, toInsert);

    const result = await builder.insert(formatted).returning('*');
    return this.formatOutput(object, result[0]);
  }

  async update(object: string, id: string | number, data: Record<string, any>, options?: DriverOptions): Promise<any> {
    const builder = this.getBuilder(object, options);
    const formatted = this.formatInput(object, data);

    if (this.tablesWithTimestamps.has(object)) {
      if (this.isSqlite) {
        const now = new Date();
        formatted.updated_at = now.toISOString().replace('T', ' ').replace('Z', '');
      } else {
        formatted.updated_at = this.knex.fn.now();
      }
    }

    await builder.where('id', id).update(formatted);

    const updated = await this.getBuilder(object, options).where('id', id).first();
    return this.formatOutput(object, updated) || null;
  }

  async upsert(object: string, data: Record<string, any>, conflictKeys?: string[], options?: DriverOptions): Promise<Record<string, any>> {
    const { _id, ...rest } = data;
    const toUpsert = { ...rest };

    if (_id !== undefined && toUpsert.id === undefined) {
      toUpsert.id = _id;
    } else if (toUpsert.id === undefined) {
      toUpsert.id = nanoid(DEFAULT_ID_LENGTH);
    }

    const formatted = this.formatInput(object, toUpsert);
    const mergeKeys = conflictKeys && conflictKeys.length > 0 ? conflictKeys : ['id'];

    const builder = this.getBuilder(object, options);
    await builder.insert(formatted).onConflict(mergeKeys).merge();

    const result = await this.getBuilder(object, options).where('id', toUpsert.id).first();
    return this.formatOutput(object, result) || toUpsert;
  }

  async delete(object: string, id: string | number, options?: DriverOptions): Promise<boolean> {
    const builder = this.getBuilder(object, options);
    const count = await builder.where('id', id).delete();
    return count > 0;
  }

  // ===================================
  // Bulk & Batch Operations
  // ===================================

  async bulkCreate(object: string, data: any[], options?: DriverOptions): Promise<any> {
    const builder = this.getBuilder(object, options);
    return await builder.insert(data).returning('*');
  }

  /**
   * Batch-update multiple records by ID.
   * NOTE: Current implementation performs sequential updates for correctness.
   * TODO: Optimize with SQL CASE statements or batched transactions for performance.
   */
  async bulkUpdate(object: string, updates: Array<{ id: string | number; data: Record<string, any> }>, options?: DriverOptions): Promise<Record<string, any>[]> {
    const results: Record<string, any>[] = [];
    for (const { id, data } of updates) {
      const updated = await this.update(object, id, data, options);
      if (updated) results.push(updated);
    }
    return results;
  }

  async bulkDelete(object: string, ids: Array<string | number>, options?: DriverOptions): Promise<void> {
    const builder = this.getBuilder(object, options);
    await builder.whereIn('id', ids).delete();
  }

  async updateMany(object: string, query: QueryAST, data: any, options?: DriverOptions): Promise<number> {
    const builder = this.getBuilder(object, options);
    if (query.where) this.applyFilters(builder, query.where);
    const count = await builder.update(data);
    return count || 0;
  }

  async deleteMany(object: string, query: QueryAST, options?: DriverOptions): Promise<number> {
    const builder = this.getBuilder(object, options);
    if (query.where) this.applyFilters(builder, query.where);
    const count = await builder.delete();
    return count || 0;
  }

  async count(object: string, query?: QueryAST, options?: DriverOptions): Promise<number> {
    const builder = this.getBuilder(object, options);

    if (query?.where) {
      this.applyFilters(builder, query.where);
    }

    const result = await builder.count<{ count: number }[]>('* as count');
    if (result && result.length > 0) {
      const row: any = result[0];
      return Number(row.count ?? row['count(*)'] ?? 0);
    }
    return 0;
  }

  // ===================================
  // Raw Execution
  // ===================================

  async execute(command: any, params?: any[], options?: DriverOptions): Promise<any> {
    if (typeof command !== 'string') {
      return command;
    }

    const builder =
      options?.transaction
        ? this.knex.raw(command, params || []).transacting(options.transaction as Knex.Transaction)
        : this.knex.raw(command, params || []);

    return await builder;
  }

  // ===================================
  // Transactions
  // ===================================

  async beginTransaction(): Promise<Knex.Transaction> {
    return await this.knex.transaction();
  }

  /** IDataDriver standard */
  async commit(transaction: unknown): Promise<void> {
    await (transaction as Knex.Transaction).commit();
  }

  /** IDataDriver standard */
  async rollback(transaction: unknown): Promise<void> {
    await (transaction as Knex.Transaction).rollback();
  }

  /** @deprecated Use commit() instead */
  async commitTransaction(trx: Knex.Transaction): Promise<void> {
    await this.commit(trx);
  }

  /** @deprecated Use rollback() instead */
  async rollbackTransaction(trx: Knex.Transaction): Promise<void> {
    await this.rollback(trx);
  }

  // ===================================
  // Aggregation
  // ===================================

  async aggregate(object: string, query: any, options?: DriverOptions): Promise<any> {
    const builder = this.getBuilder(object, options);

    if (query.where) {
      this.applyFilters(builder, query.where);
    }

    if (query.groupBy) {
      builder.groupBy(query.groupBy);
      for (const field of query.groupBy) {
        builder.select(field);
      }
    }

    const aggregates = query.aggregations || query.aggregate;
    if (aggregates) {
      for (const agg of aggregates) {
        const funcName = agg.function || agg.func;
        const rawFunc = this.mapAggregateFunc(funcName);
        if (agg.alias) {
          builder.select(this.knex.raw(`${rawFunc}(??) as ??`, [agg.field, agg.alias]));
        } else {
          builder.select(this.knex.raw(`${rawFunc}(??)`, [agg.field]));
        }
      }
    }

    return await builder;
  }

  // ===================================
  // Distinct
  // ===================================

  async distinct(object: string, field: string, filters?: any, options?: DriverOptions): Promise<any[]> {
    const builder = this.getBuilder(object, options);

    if (filters) {
      this.applyFilters(builder, filters);
    }

    builder.distinct(field);
    const results = await builder;
    return results.map((row: any) => row[field]);
  }

  // ===================================
  // Window Functions
  // ===================================

  async findWithWindowFunctions(object: string, query: any, options?: DriverOptions): Promise<any[]> {
    const builder = this.getBuilder(object, options);

    builder.select('*');

    if (query.where) {
      this.applyFilters(builder, query.where);
    }

    if (query.windowFunctions && Array.isArray(query.windowFunctions)) {
      for (const wf of query.windowFunctions) {
        const windowFunc = this.buildWindowFunction(wf);
        builder.select(this.knex.raw(`${windowFunc} as ??`, [wf.alias]));
      }
    }

    if (query.orderBy && Array.isArray(query.orderBy)) {
      for (const sort of query.orderBy) {
        builder.orderBy(this.mapSortField(sort.field), sort.order || 'asc');
      }
    }

    if (query.limit) builder.limit(query.limit);
    if (query.offset) builder.offset(query.offset);

    return await builder;
  }

  // ===================================
  // Query Plan Analysis
  // ===================================

  /** IDataDriver standard: analyze query performance */
  async explain(object: string, query: any, options?: DriverOptions): Promise<any> {
    return this.analyzeQuery(object, query, options);
  }

  async analyzeQuery(object: string, query: any, options?: DriverOptions): Promise<any> {
    const builder = this.getBuilder(object, options);

    if (query.fields) {
      builder.select(query.fields);
    } else {
      builder.select('*');
    }

    if (query.where) {
      this.applyFilters(builder, query.where);
    }

    if (query.orderBy && Array.isArray(query.orderBy)) {
      for (const sort of query.orderBy) {
        builder.orderBy(this.mapSortField(sort.field), sort.order || 'asc');
      }
    }

    if (query.limit) builder.limit(query.limit);
    if (query.offset) builder.offset(query.offset);

    const sql = builder.toSQL();
    const client = (this.config as any).client;
    let explainResults: any;

    try {
      if (this.isPostgres) {
        explainResults = await this.knex.raw(`EXPLAIN (FORMAT JSON, ANALYZE) ${sql.sql}`, sql.bindings);
      } else if (this.isMysql) {
        explainResults = await this.knex.raw(`EXPLAIN FORMAT=JSON ${sql.sql}`, sql.bindings);
      } else if (this.isSqlite) {
        explainResults = await this.knex.raw(`EXPLAIN QUERY PLAN ${sql.sql}`, sql.bindings);
      } else {
        return {
          sql: sql.sql,
          bindings: sql.bindings,
          client,
          note: 'EXPLAIN not supported for this database client',
        };
      }

      return { sql: sql.sql, bindings: sql.bindings, client, plan: explainResults };
    } catch (error: any) {
      return {
        sql: sql.sql,
        bindings: sql.bindings,
        client,
        error: error.message,
        note: 'Failed to execute EXPLAIN.',
      };
    }
  }

  // ===================================
  // Schema Sync (syncSchema / init)
  // ===================================

  async syncSchema(object: string, schema: unknown, _options?: DriverOptions): Promise<void> {
    const objectDef = schema as { name: string; fields?: Record<string, any> };
    await this.initObjects([objectDef]);
  }

  async dropTable(object: string, _options?: DriverOptions): Promise<void> {
    await this.knex.schema.dropTableIfExists(object);
  }

  /**
   * Batch-initialise tables from an array of object definitions.
   */
  async initObjects(objects: Array<{ name: string; fields?: Record<string, any> }>): Promise<void> {
    await this.ensureDatabaseExists();

    for (const obj of objects) {
      const tableName = obj.name;

      const jsonCols: string[] = [];
      const booleanCols: string[] = [];
      if (obj.fields) {
        for (const [name, field] of Object.entries<any>(obj.fields)) {
          const type = field.type || 'string';
          if (this.isJsonField(type, field)) {
            jsonCols.push(name);
          }
          if (type === 'boolean') {
            booleanCols.push(name);
          }
        }
      }
      this.jsonFields[tableName] = jsonCols;
      this.booleanFields[tableName] = booleanCols;

      let exists = await this.knex.schema.hasTable(tableName);

      if (exists) {
        const columnInfo = await this.knex(tableName).columnInfo();
        const existingColumns = Object.keys(columnInfo);

        if (existingColumns.includes('_id') && !existingColumns.includes('id')) {
          await this.knex.schema.dropTable(tableName);
          exists = false;
        }
      }

      if (!exists) {
        await this.knex.schema.createTable(tableName, (table) => {
          table.string('id').primary();
          table.timestamp('created_at').defaultTo(this.knex.fn.now());
          table.timestamp('updated_at').defaultTo(this.knex.fn.now());
          if (obj.fields) {
            for (const [name, field] of Object.entries(obj.fields)) {
              this.createColumn(table, name, field);
            }
          }
        });
        this.tablesWithTimestamps.add(tableName);
      } else {
        const columnInfo = await this.knex(tableName).columnInfo();
        const existingColumns = Object.keys(columnInfo);

        if (existingColumns.includes('updated_at')) {
          this.tablesWithTimestamps.add(tableName);
        }

        await this.knex.schema.alterTable(tableName, (table) => {
          if (obj.fields) {
            for (const [name, field] of Object.entries(obj.fields)) {
              if (!existingColumns.includes(name)) {
                this.createColumn(table, name, field);
              }
            }
          }
        });
      }
    }
  }

  // ===================================
  // Schema Introspection
  // ===================================

  async introspectSchema(): Promise<IntrospectedSchema> {
    const tables: Record<string, IntrospectedTable> = {};
    let tableNames: string[] = [];

    if (this.isPostgres) {
      const result = await this.knex.raw(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      `);
      tableNames = result.rows.map((row: any) => row.table_name);
    } else if (this.isMysql) {
      const result = await this.knex.raw(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
      `);
      tableNames = result[0].map((row: any) => row.TABLE_NAME);
    } else if (this.isSqlite) {
      const result = await this.knex.raw(`
        SELECT name as table_name
        FROM sqlite_master
        WHERE type='table'
        AND name NOT LIKE 'sqlite_%'
      `);
      tableNames = result.map((row: any) => row.table_name);
    }

    for (const tableName of tableNames) {
      const columns = await this.introspectColumns(tableName);
      const foreignKeys = await this.introspectForeignKeys(tableName);
      const primaryKeys = await this.introspectPrimaryKeys(tableName);
      const uniqueConstraints = await this.introspectUniqueConstraints(tableName);

      for (const col of columns) {
        if (primaryKeys.includes(col.name)) col.isPrimary = true;
        if (uniqueConstraints.includes(col.name)) col.isUnique = true;
      }

      tables[tableName] = { name: tableName, columns, foreignKeys, primaryKeys };
    }

    return { tables };
  }

  // ===================================
  // Internal helpers
  // ===================================

  /** Expose the underlying Knex instance for advanced usage. */
  getKnex(): Knex {
    return this.knex;
  }

  protected getBuilder(object: string, options?: DriverOptions) {
    let builder = this.knex(object);
    if (options?.transaction) {
      builder = builder.transacting(options.transaction as Knex.Transaction);
    }
    return builder;
  }

  // ── Filter helpers ──────────────────────────────────────────────────────────

  protected applyFilters(builder: Knex.QueryBuilder, filters: any) {
    if (!filters) return;

    if (!Array.isArray(filters) && typeof filters === 'object') {
      const hasMongoOperators = Object.keys(filters).some(
        (k) =>
          k.startsWith('$') ||
          (typeof filters[k] === 'object' &&
            filters[k] !== null &&
            Object.keys(filters[k]).some((op) => op.startsWith('$'))),
      );

      if (hasMongoOperators) {
        this.applyFilterCondition(builder, filters);
        return;
      }

      for (const [key, value] of Object.entries(filters)) {
        if (['limit', 'offset', 'fields', 'orderBy'].includes(key)) continue;
        builder.where(key, value as any);
      }
      return;
    }

    if (!Array.isArray(filters) || filters.length === 0) return;

    let nextJoin: 'and' | 'or' = 'and';

    for (const item of filters) {
      if (typeof item === 'string') {
        if (item.toLowerCase() === 'or') nextJoin = 'or';
        else if (item.toLowerCase() === 'and') nextJoin = 'and';
        continue;
      }

      if (Array.isArray(item)) {
        const [fieldRaw, op, value] = item;
        const isCriterion = typeof fieldRaw === 'string' && typeof op === 'string';

        if (isCriterion) {
          const field = this.mapSortField(fieldRaw);
          const apply = (b: any) => {
            const method = nextJoin === 'or' ? 'orWhere' : 'where';
            const methodIn = nextJoin === 'or' ? 'orWhereIn' : 'whereIn';
            const methodNotIn = nextJoin === 'or' ? 'orWhereNotIn' : 'whereNotIn';

            if (op === 'contains') {
              b[method](field, 'like', `%${value}%`);
              return;
            }

            switch (op) {
              case '=':
                b[method](field, value);
                break;
              case '!=':
                b[method](field, '<>', value);
                break;
              case 'in':
                b[methodIn](field, value);
                break;
              case 'nin':
                b[methodNotIn](field, value);
                break;
              default:
                b[method](field, op, value);
            }
          };
          apply(builder);
        } else {
          const method = nextJoin === 'or' ? 'orWhere' : 'where';
          (builder as any)[method]((qb: any) => {
            this.applyFilters(qb, item);
          });
        }

        nextJoin = 'and';
      }
    }
  }

  protected applyFilterCondition(builder: Knex.QueryBuilder, condition: any, logicalOp: 'and' | 'or' = 'and') {
    if (!condition || typeof condition !== 'object') return;

    for (const [key, value] of Object.entries(condition)) {
      if (key === '$and' && Array.isArray(value)) {
        builder.where((qb) => {
          for (const sub of value) {
            qb.where((subQb) => {
              this.applyFilterCondition(subQb, sub, 'and');
            });
          }
        });
      } else if (key === '$or' && Array.isArray(value)) {
        const method = logicalOp === 'or' ? 'orWhere' : 'where';
        (builder as any)[method]((qb: any) => {
          for (const sub of value) {
            qb.orWhere((subQb: any) => {
              this.applyFilterCondition(subQb, sub, 'or');
            });
          }
        });
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const field = this.mapSortField(key);
        for (const [op, opValue] of Object.entries(value as Record<string, any>)) {
          const method = logicalOp === 'or' ? 'orWhere' : 'where';
          switch (op) {
            case '$eq':
              (builder as any)[method](field, opValue);
              break;
            case '$ne':
              (builder as any)[method](field, '<>', opValue);
              break;
            case '$gt':
              (builder as any)[method](field, '>', opValue);
              break;
            case '$gte':
              (builder as any)[method](field, '>=', opValue);
              break;
            case '$lt':
              (builder as any)[method](field, '<', opValue);
              break;
            case '$lte':
              (builder as any)[method](field, '<=', opValue);
              break;
            case '$in': {
              const mIn = logicalOp === 'or' ? 'orWhereIn' : 'whereIn';
              (builder as any)[mIn](field, opValue as any[]);
              break;
            }
            case '$nin': {
              const mNotIn = logicalOp === 'or' ? 'orWhereNotIn' : 'whereNotIn';
              (builder as any)[mNotIn](field, opValue as any[]);
              break;
            }
            case '$contains':
              (builder as any)[method](field, 'like', `%${opValue}%`);
              break;
            default:
              (builder as any)[method](field, opValue);
          }
        }
      } else {
        const field = this.mapSortField(key);
        const method = logicalOp === 'or' ? 'orWhere' : 'where';
        (builder as any)[method](field, value as any);
      }
    }
  }

  // ── Field mapping ───────────────────────────────────────────────────────────

  protected mapSortField(field: string): string {
    if (field === 'createdAt') return 'created_at';
    if (field === 'updatedAt') return 'updated_at';
    return field;
  }

  protected mapAggregateFunc(func: string): string {
    switch (func) {
      case 'count':
        return 'count';
      case 'sum':
        return 'sum';
      case 'avg':
        return 'avg';
      case 'min':
        return 'min';
      case 'max':
        return 'max';
      default:
        throw new Error(`Unsupported aggregate function: ${func}`);
    }
  }

  // ── Window function builder ─────────────────────────────────────────────────

  protected buildWindowFunction(spec: any): string {
    const func = spec.function.toUpperCase();
    let sql = `${func}()`;

    const overParts: string[] = [];

    if (spec.partitionBy && Array.isArray(spec.partitionBy) && spec.partitionBy.length > 0) {
      const partitionFields = spec.partitionBy.map((f: string) => this.mapSortField(f)).join(', ');
      overParts.push(`PARTITION BY ${partitionFields}`);
    }

    if (spec.orderBy && Array.isArray(spec.orderBy) && spec.orderBy.length > 0) {
      const orderFields = spec.orderBy
        .map((s: any) => {
          const field = this.mapSortField(s.field);
          const order = (s.order || 'asc').toUpperCase();
          return `${field} ${order}`;
        })
        .join(', ');
      overParts.push(`ORDER BY ${orderFields}`);
    }

    sql += overParts.length > 0 ? ` OVER (${overParts.join(' ')})` : ` OVER ()`;
    return sql;
  }

  // ── Column creation helper ──────────────────────────────────────────────────

  protected createColumn(table: Knex.CreateTableBuilder, name: string, field: any) {
    if (field.multiple) {
      table.json(name);
      return;
    }

    const type = field.type || 'string';
    let col: any;
    switch (type) {
      case 'string':
      case 'email':
      case 'url':
      case 'phone':
      case 'password':
        col = table.string(name);
        break;
      case 'text':
      case 'textarea':
      case 'html':
      case 'markdown':
        col = table.text(name);
        break;
      case 'integer':
      case 'int':
        col = table.integer(name);
        break;
      case 'float':
      case 'number':
      case 'currency':
      case 'percent':
        col = table.float(name);
        break;
      case 'boolean':
        col = table.boolean(name);
        break;
      case 'date':
        col = table.date(name);
        break;
      case 'datetime':
        col = table.timestamp(name);
        break;
      case 'time':
        col = table.time(name);
        break;
      case 'json':
      case 'object':
      case 'array':
      case 'image':
      case 'file':
      case 'avatar':
      case 'location':
        col = table.json(name);
        break;
      case 'lookup':
        col = table.string(name);
        if (field.reference_to) {
          table.foreign(name).references('id').inTable(field.reference_to);
        }
        break;
      case 'summary':
        col = table.float(name);
        break;
      case 'auto_number':
        col = table.string(name);
        break;
      case 'formula':
        return; // Virtual — no column
      default:
        col = table.string(name);
    }

    if (col) {
      if (field.unique) col.unique();
      if (field.required) col.notNullable();
    }
  }

  // ── Database helpers ────────────────────────────────────────────────────────

  protected async ensureDatabaseExists() {
    if (!this.isPostgres) return;

    try {
      await this.knex.raw('SELECT 1');
    } catch (e: any) {
      if (e.code === '3D000') {
        await this.createDatabase();
      } else {
        throw e;
      }
    }
  }

  protected async createDatabase() {
    const config = this.config as any;
    const connection = config.connection;
    let dbName = '';
    const adminConfig = { ...config };

    if (typeof connection === 'string') {
      const url = new URL(connection);
      dbName = url.pathname.slice(1);
      url.pathname = '/postgres';
      adminConfig.connection = url.toString();
    } else {
      dbName = connection.database;
      adminConfig.connection = { ...connection, database: 'postgres' };
    }

    const adminKnex = knex(adminConfig);
    try {
      await adminKnex.raw(`CREATE DATABASE "${dbName}"`);
    } finally {
      await adminKnex.destroy();
    }
  }

  protected isJsonField(type: string, field: any): boolean {
    return ['json', 'object', 'array', 'image', 'file', 'avatar', 'location'].includes(type) || field.multiple;
  }

  // ── SQLite serialisation ────────────────────────────────────────────────────

  protected formatInput(object: string, data: any): any {
    if (!this.isSqlite) return data;

    const fields = this.jsonFields[object];
    if (!fields || fields.length === 0) return data;

    const copy = { ...data };
    for (const field of fields) {
      if (copy[field] !== undefined && typeof copy[field] === 'object' && copy[field] !== null) {
        copy[field] = JSON.stringify(copy[field]);
      }
    }
    return copy;
  }

  protected formatOutput(object: string, data: any): any {
    if (!data) return data;

    if (this.isSqlite) {
      const jsonFields = this.jsonFields[object];
      if (jsonFields && jsonFields.length > 0) {
        for (const field of jsonFields) {
          if (data[field] !== undefined && typeof data[field] === 'string') {
            try {
              data[field] = JSON.parse(data[field]);
            } catch {
              // keep as string
            }
          }
        }
      }

      const booleanFields = this.booleanFields[object];
      if (booleanFields && booleanFields.length > 0) {
        for (const field of booleanFields) {
          if (data[field] !== undefined && data[field] !== null) {
            data[field] = Boolean(data[field]);
          }
        }
      }
    }

    return data;
  }

  // ── Introspection internals ─────────────────────────────────────────────────

  protected async introspectColumns(tableName: string): Promise<IntrospectedColumn[]> {
    const columnInfo = await this.knex(tableName).columnInfo();
    const columns: IntrospectedColumn[] = [];

    for (const [colName, info] of Object.entries<any>(columnInfo)) {
      let type = 'string';
      let maxLength: number | undefined;

      if (this.isSqlite) {
        type = info.type?.toLowerCase() || 'string';
      } else {
        type = info.type || 'string';
      }

      if (info.maxLength) {
        maxLength = info.maxLength;
      }

      columns.push({
        name: colName,
        type,
        nullable: info.nullable !== false,
        defaultValue: info.defaultValue,
        isPrimary: false,
        isUnique: false,
        maxLength,
      });
    }

    return columns;
  }

  protected async introspectForeignKeys(tableName: string): Promise<IntrospectedForeignKey[]> {
    const foreignKeys: IntrospectedForeignKey[] = [];

    try {
      if (this.isPostgres) {
        const result = await this.knex.raw(
          `
          SELECT
            kcu.column_name,
            ccu.table_name AS referenced_table,
            ccu.column_name AS referenced_column,
            tc.constraint_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = ?
        `,
          [tableName],
        );

        for (const row of result.rows) {
          foreignKeys.push({
            columnName: row.column_name,
            referencedTable: row.referenced_table,
            referencedColumn: row.referenced_column,
            constraintName: row.constraint_name,
          });
        }
      } else if (this.isMysql) {
        const result = await this.knex.raw(
          `
          SELECT
            COLUMN_NAME as column_name,
            REFERENCED_TABLE_NAME as referenced_table,
            REFERENCED_COLUMN_NAME as referenced_column,
            CONSTRAINT_NAME as constraint_name
          FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND REFERENCED_TABLE_NAME IS NOT NULL
        `,
          [tableName],
        );

        for (const row of result[0]) {
          foreignKeys.push({
            columnName: row.column_name,
            referencedTable: row.referenced_table,
            referencedColumn: row.referenced_column,
            constraintName: row.constraint_name,
          });
        }
      } else if (this.isSqlite) {
        const tableExistsResult = await this.knex.raw(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
          [tableName],
        );

        if (!Array.isArray(tableExistsResult) || tableExistsResult.length === 0) {
          return foreignKeys;
        }

        const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
        const result = await this.knex.raw(`PRAGMA foreign_key_list(${safeTableName})`);

        for (const row of result) {
          foreignKeys.push({
            columnName: row.from,
            referencedTable: row.table,
            referencedColumn: row.to,
            constraintName: `fk_${tableName}_${row.from}`,
          });
        }
      }
    } catch {
      // silently ignore introspection errors
    }

    return foreignKeys;
  }

  protected async introspectPrimaryKeys(tableName: string): Promise<string[]> {
    const primaryKeys: string[] = [];

    try {
      if (this.isPostgres) {
        const result = await this.knex.raw(
          `
          SELECT a.attname as column_name
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid
            AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = ?::regclass
            AND i.indisprimary
        `,
          [tableName],
        );

        for (const row of result.rows) {
          primaryKeys.push(row.column_name);
        }
      } else if (this.isMysql) {
        const result = await this.knex.raw(
          `
          SELECT COLUMN_NAME as column_name
          FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND CONSTRAINT_NAME = 'PRIMARY'
        `,
          [tableName],
        );

        for (const row of result[0]) {
          primaryKeys.push(row.column_name);
        }
      } else if (this.isSqlite) {
        const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

        const tablesResult = await this.knex.raw("SELECT name FROM sqlite_master WHERE type = 'table'");
        const tableNames = Array.isArray(tablesResult) ? tablesResult.map((row: any) => row.name) : [];

        if (!tableNames.includes(safeTableName)) {
          return primaryKeys;
        }

        const result = await this.knex.raw(`PRAGMA table_info(${safeTableName})`);

        for (const row of result) {
          if (row.pk === 1) {
            primaryKeys.push(row.name);
          }
        }
      }
    } catch {
      // silently ignore
    }

    return primaryKeys;
  }

  protected async introspectUniqueConstraints(tableName: string): Promise<string[]> {
    const uniqueColumns: string[] = [];

    try {
      if (this.isPostgres) {
        const result = await this.knex.raw(
          `
          SELECT c.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.constraint_column_usage AS ccu
            ON tc.constraint_schema = ccu.constraint_schema
            AND tc.constraint_name = ccu.constraint_name
          WHERE tc.constraint_type = 'UNIQUE'
            AND tc.table_name = ?
        `,
          [tableName],
        );

        for (const row of result.rows) {
          uniqueColumns.push(row.column_name);
        }
      } else if (this.isMysql) {
        const result = await this.knex.raw(
          `
          SELECT COLUMN_NAME
          FROM information_schema.TABLE_CONSTRAINTS tc
          JOIN information_schema.KEY_COLUMN_USAGE kcu
            USING (CONSTRAINT_NAME, TABLE_SCHEMA, TABLE_NAME)
          WHERE CONSTRAINT_TYPE = 'UNIQUE'
            AND TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
        `,
          [tableName],
        );

        for (const row of result[0]) {
          uniqueColumns.push(row.COLUMN_NAME);
        }
      } else if (this.isSqlite) {
        const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

        const tablesResult = await this.knex.raw("SELECT name FROM sqlite_master WHERE type = 'table'");
        const tableNames = Array.isArray(tablesResult) ? tablesResult.map((row: any) => row.name) : [];

        if (!tableNames.includes(safeTableName)) {
          return uniqueColumns;
        }

        const indexes = await this.knex.raw(`PRAGMA index_list(${safeTableName})`);

        for (const idx of indexes) {
          if (idx.unique === 1) {
            const info = await this.knex.raw(`PRAGMA index_info(${idx.name})`);
            if (info.length === 1) {
              uniqueColumns.push(info[0].name);
            }
          }
        }
      }
    } catch {
      // silently ignore
    }

    return uniqueColumns;
  }
}
