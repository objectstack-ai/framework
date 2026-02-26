// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { QueryAST, QueryInput, DriverOptions } from '@objectstack/spec/data';
import type { DriverInterface } from '@objectstack/core';
import { Logger, createLogger } from '@objectstack/core';
import { Query, Aggregator } from 'mingo';
import { getValueByPath } from './memory-matcher.js';

/**
 * Persistence adapter interface.
 * Matches the PersistenceAdapterSchema contract from @objectstack/spec.
 */
export interface PersistenceAdapterInterface {
  load(): Promise<Record<string, any[]> | null>;
  save(db: Record<string, any[]>): Promise<void>;
  flush(): Promise<void>;
  /** Optional: Start periodic auto-save (used by FileSystemPersistenceAdapter). */
  startAutoSave?(): void;
  /** Optional: Stop auto-save timer and flush pending writes. */
  stopAutoSave?(): Promise<void>;
}

/**
 * Configuration options for the InMemory driver.
 * Aligned with @objectstack/spec MemoryConfigSchema.
 */
export interface InMemoryDriverConfig {
  /** Optional: Initial data to populate the store */
  initialData?: Record<string, Record<string, unknown>[]>;
  /** Optional: Enable strict mode (throw on missing records) */
  strictMode?: boolean;
  /** Optional: Logger instance */
  logger?: Logger;
  /**
   * Optional persistence configuration.
   * - `'file'` — File-system persistence with defaults (Node.js only)
   * - `'local'` — localStorage persistence with defaults (Browser only)
   * - `{ type: 'file', path?: string, autoSaveInterval?: number }` — File-system with options
   * - `{ type: 'local', key?: string }` — localStorage with options
   * - `{ adapter: PersistenceAdapterInterface }` — Custom adapter
   */
  persistence?: string | {
    type?: 'file' | 'local';
    path?: string;
    key?: string;
    autoSaveInterval?: number;
    adapter?: PersistenceAdapterInterface;
  };
}

/**
 * Snapshot for in-memory transactions.
 */
interface MemoryTransaction {
  id: string;
  snapshot: Record<string, any[]>;
}

/**
 * In-Memory Driver for ObjectStack
 * 
 * A production-ready implementation of the ObjectStack Driver Protocol
 * powered by Mingo — a MongoDB-compatible query and aggregation engine.
 * 
 * Features:
 * - MongoDB-compatible query engine (Mingo) for filtering, projection, aggregation
 * - Full CRUD and bulk operations
 * - Aggregation pipeline support ($match, $group, $sort, $project, $unwind, etc.)
 * - Snapshot-based transactions (begin/commit/rollback)
 * - Field projection and distinct values
 * - Strict mode and initial data loading
 * 
 * Reference: objectql/packages/drivers/memory
 */
export class InMemoryDriver implements DriverInterface {
  name = 'com.objectstack.driver.memory';
  type = 'driver';
  version = '1.0.0';
  private config: InMemoryDriverConfig;
  private logger: Logger;
  private idCounters: Map<string, number> = new Map();
  private transactions: Map<string, MemoryTransaction> = new Map();
  private persistenceAdapter: PersistenceAdapterInterface | null = null;

  constructor(config?: InMemoryDriverConfig) {
    this.config = config || {};
    this.logger = config?.logger || createLogger({ level: 'info', format: 'pretty' });
    this.logger.debug('InMemory driver instance created');
  }

  // Duck-typed RuntimePlugin hook
  install(ctx: any) {
    this.logger.debug('Installing InMemory driver via plugin hook');
    if (ctx.engine && ctx.engine.ql && typeof ctx.engine.ql.registerDriver === 'function') {
        ctx.engine.ql.registerDriver(this);
        this.logger.info('InMemory driver registered with ObjectQL engine');
    } else {
        this.logger.warn('Could not register driver - ObjectQL engine not found in context');
    }
  }
  
  supports = {
    // Transaction & Connection Management
    transactions: true,          // Snapshot-based transactions
    
    // Query Operations
    queryFilters: true,          // Implemented via memory-matcher
    queryAggregations: true,     // Implemented
    querySorting: true,          // Implemented via JS sort
    queryPagination: true,       // Implemented
    queryWindowFunctions: false, // @planned: Window functions (ROW_NUMBER, RANK, etc.)
    querySubqueries: false,      // @planned: Subquery execution
    joins: false,                // @planned: In-memory join operations
    
    // Advanced Features
    fullTextSearch: false,       // @planned: Text tokenization + matching
    vectorSearch: false,         // @planned: Cosine similarity search
    geoSpatial: false,           // @planned: Distance/within calculations
    jsonFields: true,            // Native JS object support
    arrayFields: true,           // Native JS array support
  };

  /**
   * The "Database": A map of TableName -> Array of Records
   */
  private db: Record<string, any[]> = {};

  // ===================================
  // Lifecycle
  // ===================================

  async connect() {
    // Initialize persistence adapter if configured
    await this.initPersistence();

    // Load persisted data if available
    if (this.persistenceAdapter) {
      const persisted = await this.persistenceAdapter.load();
      if (persisted) {
        for (const [objectName, records] of Object.entries(persisted)) {
          this.db[objectName] = records;
          // Update ID counters based on persisted data
          for (const record of records) {
            if (record.id && typeof record.id === 'string') {
              // ID format: {objectName}-{timestamp}-{counter}
              const parts = record.id.split('-');
              const lastPart = parts[parts.length - 1];
              const counter = parseInt(lastPart, 10);
              if (!isNaN(counter)) {
                const current = this.idCounters.get(objectName) || 0;
                if (counter > current) {
                  this.idCounters.set(objectName, counter);
                }
              }
            }
          }
        }
        this.logger.info('InMemory Database restored from persistence', {
          tables: Object.keys(persisted).length,
        });
      }
    }

    // Load initial data if provided
    if (this.config.initialData) {
      for (const [objectName, records] of Object.entries(this.config.initialData)) {
        const table = this.getTable(objectName);
        for (const record of records) {
          const id = (record as any).id || this.generateId(objectName);
          table.push({ ...record, id });
        }
      }
      this.logger.info('InMemory Database Connected with initial data', {
        tables: Object.keys(this.config.initialData).length,
      });
    } else {
      this.logger.info('InMemory Database Connected (Virtual)');
    }

    // Start auto-save if using file adapter
    if (this.persistenceAdapter?.startAutoSave) {
      this.persistenceAdapter.startAutoSave();
    }
  }

  async disconnect() {
    // Stop auto-save and flush pending writes
    if (this.persistenceAdapter) {
      if (this.persistenceAdapter.stopAutoSave) {
        await this.persistenceAdapter.stopAutoSave();
      }
      await this.persistenceAdapter.flush();
    }

    const tableCount = Object.keys(this.db).length;
    const recordCount = Object.values(this.db).reduce((sum, table) => sum + table.length, 0);
    
    this.db = {};
    this.logger.info('InMemory Database Disconnected & Cleared', { 
      tableCount, 
      recordCount 
    });
  }

  async checkHealth() {
    this.logger.debug('Health check performed', { 
      tableCount: Object.keys(this.db).length,
      status: 'healthy' 
    });
    return true; 
  }

  // ===================================
  // Execution
  // ===================================

  async execute(command: any, params?: any[]) {
    this.logger.warn('Raw execution not supported in InMemory driver', { command });
    return null;
  }

  // ===================================
  // CRUD
  // ===================================

  async find(object: string, query: QueryInput, options?: DriverOptions) {
    this.logger.debug('Find operation', { object, query });
    
    const table = this.getTable(object);
    let results = [...table]; // Work on copy

    // 1. Filter using Mingo
    if (query.where) {
        const mongoQuery = this.convertToMongoQuery(query.where);
        if (mongoQuery && Object.keys(mongoQuery).length > 0) {
          const mingoQuery = new Query(mongoQuery);
          results = mingoQuery.find(results).all();
        }
    }

    // 1.5 Aggregation & Grouping
    if (query.groupBy || (query.aggregations && query.aggregations.length > 0)) {
        results = this.performAggregation(results, query);
    }

    // 2. Sort
    if (query.orderBy) {
        const sortFields = Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy];
        results = this.applySort(results, sortFields);
    }

    // 3. Pagination (Offset)
    if (query.offset) {
        results = results.slice(query.offset);
    }

    // 4. Pagination (Limit)
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    // 5. Field Projection
    if (query.fields && Array.isArray(query.fields) && query.fields.length > 0) {
      results = results.map(record => this.projectFields(record, query.fields as string[]));
    }

    this.logger.debug('Find completed', { object, resultCount: results.length });
    return results;
  }

  async *findStream(object: string, query: QueryInput, options?: DriverOptions) {
    this.logger.debug('FindStream operation', { object });
    
    const results = await this.find(object, query, options);
    for (const record of results) {
      yield record;
    }
  }

  async findOne(object: string, query: QueryInput, options?: DriverOptions) {
    this.logger.debug('FindOne operation', { object, query });
    
    const results = await this.find(object, { ...query, limit: 1 }, options);
    const result = results[0] || null;
    
    this.logger.debug('FindOne completed', { object, found: !!result });
    return result;
  }

  async create(object: string, data: Record<string, any>, options?: DriverOptions) {
    this.logger.debug('Create operation', { object, hasData: !!data });
    
    const table = this.getTable(object);
    
    const newRecord = {
      id: data.id || this.generateId(object),
      ...data,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
    };

    table.push(newRecord);
    this.markDirty();
    this.logger.debug('Record created', { object, id: newRecord.id, tableSize: table.length });
    return { ...newRecord };
  }

  async update(object: string, id: string | number, data: Record<string, any>, options?: DriverOptions) {
    this.logger.debug('Update operation', { object, id });
    
    const table = this.getTable(object);
    const index = table.findIndex(r => r.id == id);
    
    if (index === -1) {
      if (this.config.strictMode) {
        this.logger.warn('Record not found for update', { object, id });
        throw new Error(`Record with ID ${id} not found in ${object}`);
      }
      return null;
    }

    const updatedRecord = {
      ...table[index],
      ...data,
      id: table[index].id, // Preserve original ID
      created_at: table[index].created_at, // Preserve created_at
      updated_at: new Date().toISOString(),
    };
    
    table[index] = updatedRecord;
    this.markDirty();
    this.logger.debug('Record updated', { object, id });
    return { ...updatedRecord };
  }

  async upsert(object: string, data: Record<string, any>, conflictKeys?: string[], options?: DriverOptions) {
    this.logger.debug('Upsert operation', { object, conflictKeys });
    
    const table = this.getTable(object);
    let existingRecord: any = null;

    if (data.id) {
        existingRecord = table.find(r => r.id === data.id);
    } else if (conflictKeys && conflictKeys.length > 0) {
        existingRecord = table.find(r => conflictKeys.every(key => r[key] === data[key]));
    }

    if (existingRecord) {
        this.logger.debug('Record exists, updating', { object, id: existingRecord.id });
        return this.update(object, existingRecord.id, data, options);
    } else {
        this.logger.debug('Record does not exist, creating', { object });
        return this.create(object, data, options);
    }
  }

  async delete(object: string, id: string | number, options?: DriverOptions) {
    this.logger.debug('Delete operation', { object, id });
    
    const table = this.getTable(object);
    const index = table.findIndex(r => r.id == id);
    
    if (index === -1) {
      if (this.config.strictMode) {
        throw new Error(`Record with ID ${id} not found in ${object}`);
      }
      this.logger.warn('Record not found for deletion', { object, id });
      return false;
    }

    table.splice(index, 1);
    this.markDirty();
    this.logger.debug('Record deleted', { object, id, tableSize: table.length });
    return true;
  }

  async count(object: string, query?: QueryInput, options?: DriverOptions) {
    let records = this.getTable(object);
    if (query?.where) {
        const mongoQuery = this.convertToMongoQuery(query.where);
        if (mongoQuery && Object.keys(mongoQuery).length > 0) {
          const mingoQuery = new Query(mongoQuery);
          records = mingoQuery.find(records).all();
        }
    }
    const count = records.length;
    this.logger.debug('Count operation', { object, count });
    return count;
  }

  // ===================================
  // Bulk Operations
  // ===================================

  async bulkCreate(object: string, dataArray: Record<string, any>[], options?: DriverOptions) {
    this.logger.debug('BulkCreate operation', { object, count: dataArray.length });
    const results = await Promise.all(dataArray.map(data => this.create(object, data, options)));
    this.logger.debug('BulkCreate completed', { object, count: results.length });
    return results;
  }
  
  async updateMany(object: string, query: QueryInput, data: Record<string, any>, options?: DriverOptions) {
      this.logger.debug('UpdateMany operation', { object, query });
      
      const table = this.getTable(object);
      let targetRecords = table;
      
      if (query && query.where) {
          const mongoQuery = this.convertToMongoQuery(query.where);
          if (mongoQuery && Object.keys(mongoQuery).length > 0) {
            const mingoQuery = new Query(mongoQuery);
            targetRecords = mingoQuery.find(targetRecords).all();
          }
      }
      
      const count = targetRecords.length;
      
      for (const record of targetRecords) {
          const index = table.findIndex(r => r.id === record.id);
          if (index !== -1) {
              const updated = {
                  ...table[index],
                  ...data,
                  updated_at: new Date().toISOString()
              };
              table[index] = updated;
          }
      }
      
      if (count > 0) this.markDirty();
      this.logger.debug('UpdateMany completed', { object, count });
      return { count };
  }

  async deleteMany(object: string, query: QueryInput, options?: DriverOptions) {
      this.logger.debug('DeleteMany operation', { object, query });
      
      const table = this.getTable(object);
      const initialLength = table.length;
      
      if (query && query.where) {
          const mongoQuery = this.convertToMongoQuery(query.where);
          if (mongoQuery && Object.keys(mongoQuery).length > 0) {
            const mingoQuery = new Query(mongoQuery);
            const matched = mingoQuery.find(table).all();
            const matchedIds = new Set(matched.map((r: any) => r.id));
            this.db[object] = table.filter(r => !matchedIds.has(r.id));
          } else {
            // Empty query = delete all
            this.db[object] = [];
          }
      } else {
          // No where clause = delete all
          this.db[object] = [];
      }
      
      const count = initialLength - this.db[object].length;
      if (count > 0) this.markDirty();
      this.logger.debug('DeleteMany completed', { object, count });
      return { count };
  }

  // Compatibility aliases
  async bulkUpdate(object: string, updates: { id: string | number, data: Record<string, any> }[], options?: DriverOptions) {
    this.logger.debug('BulkUpdate operation', { object, count: updates.length });
    const results = await Promise.all(updates.map(u => this.update(object, u.id, u.data, options)));
    this.logger.debug('BulkUpdate completed', { object, count: results.length });
    return results;
  }

  async bulkDelete(object: string, ids: (string | number)[], options?: DriverOptions) {
    this.logger.debug('BulkDelete operation', { object, count: ids.length });
    await Promise.all(ids.map(id => this.delete(object, id, options)));
    this.logger.debug('BulkDelete completed', { object, count: ids.length });
  }

  // ===================================
  // Transaction Management
  // ===================================

  async beginTransaction() {
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Deep-clone current database state as a snapshot
    const snapshot: Record<string, any[]> = {};
    for (const [table, records] of Object.entries(this.db)) {
      snapshot[table] = records.map(r => ({ ...r }));
    }

    const transaction: MemoryTransaction = { id: txId, snapshot };
    this.transactions.set(txId, transaction);
    this.logger.debug('Transaction started', { txId });
    return { id: txId };
  }

  async commit(txHandle?: unknown) {
    const txId = (txHandle as any)?.id;
    if (!txId || !this.transactions.has(txId)) {
      this.logger.warn('Commit called with unknown transaction');
      return;
    }
    // Data is already in the store; just remove the snapshot
    this.transactions.delete(txId);
    this.logger.debug('Transaction committed', { txId });
  }

  async rollback(txHandle?: unknown) {
    const txId = (txHandle as any)?.id;
    if (!txId || !this.transactions.has(txId)) {
      this.logger.warn('Rollback called with unknown transaction');
      return;
    }
    const tx = this.transactions.get(txId)!;
    // Restore the snapshot
    this.db = tx.snapshot;
    this.transactions.delete(txId);
    this.markDirty();
    this.logger.debug('Transaction rolled back', { txId });
  }

  // ===================================
  // Utility Methods
  // ===================================

  /**
   * Remove all data from the store.
   */
  async clear() {
    this.db = {};
    this.idCounters.clear();
    this.markDirty();
    this.logger.debug('All data cleared');
  }

  /**
   * Get total number of records across all tables.
   */
  getSize(): number {
    return Object.values(this.db).reduce((sum, table) => sum + table.length, 0);
  }

  /**
   * Get distinct values for a field, optionally filtered.
   */
  async distinct(object: string, field: string, query?: QueryInput): Promise<any[]> {
    let records = this.getTable(object);
    if (query?.where) {
      const mongoQuery = this.convertToMongoQuery(query.where);
      if (mongoQuery && Object.keys(mongoQuery).length > 0) {
        const mingoQuery = new Query(mongoQuery);
        records = mingoQuery.find(records).all();
      }
    }
    const values = new Set<any>();
    for (const record of records) {
      const value = getValueByPath(record, field);
      if (value !== undefined && value !== null) {
        values.add(value);
      }
    }
    return Array.from(values);
  }

  /**
   * Execute a MongoDB-style aggregation pipeline using Mingo.
   * 
   * Supports all standard MongoDB pipeline stages:
   * - $match, $group, $sort, $project, $unwind, $limit, $skip
   * - $addFields, $replaceRoot, $lookup (limited), $count
   * - Accumulator operators: $sum, $avg, $min, $max, $first, $last, $push, $addToSet
   * 
   * @example
   * // Group by status and count
   * const results = await driver.aggregate('orders', [
   *   { $match: { status: 'completed' } },
   *   { $group: { _id: '$customer', totalAmount: { $sum: '$amount' } } }
   * ]);
   * 
   * @example
   * // Calculate average with filter
   * const results = await driver.aggregate('products', [
   *   { $match: { category: 'electronics' } },
   *   { $group: { _id: null, avgPrice: { $avg: '$price' } } }
   * ]);
   */
  async aggregate(object: string, pipeline: Record<string, any>[], options?: DriverOptions): Promise<any[]> {
    this.logger.debug('Aggregate operation', { object, stageCount: pipeline.length });
    
    const records = this.getTable(object).map(r => ({ ...r }));
    const aggregator = new Aggregator(pipeline);
    const results = aggregator.run(records);
    
    this.logger.debug('Aggregate completed', { object, resultCount: results.length });
    return results;
  }

  // ===================================
  // Query Conversion (ObjectQL → MongoDB)
  // ===================================

  /**
   * Convert ObjectQL filter format to MongoDB query format for Mingo.
   * 
   * Supports:
   * 1. AST Comparison Node: { type: 'comparison', field, operator, value }
   * 2. AST Logical Node: { type: 'logical', operator: 'and'|'or', conditions: [...] }
   * 3. Legacy Array Format: [['field', 'op', value], 'and', ['field2', 'op', value2]]
   * 4. MongoDB Format: { field: value } or { field: { $eq: value } } (passthrough)
   */
  private convertToMongoQuery(filters?: any): Record<string, any> {
    if (!filters) return {};

    // AST node format (ObjectQL QueryAST)
    if (!Array.isArray(filters) && typeof filters === 'object') {
      if (filters.type === 'comparison') {
        return this.convertConditionToMongo(filters.field, filters.operator, filters.value) || {};
      }
      if (filters.type === 'logical') {
        const conditions = filters.conditions?.map((c: any) => this.convertToMongoQuery(c)) || [];
        if (conditions.length === 0) return {};
        if (conditions.length === 1) return conditions[0];
        const op = filters.operator === 'or' ? '$or' : '$and';
        return { [op]: conditions };
      }
      // MongoDB format passthrough: { field: value } or { field: { $eq: value } }
      return filters;
    }

    // Legacy array format
    if (!Array.isArray(filters) || filters.length === 0) return {};

    const logicGroups: { logic: 'and' | 'or'; conditions: Record<string, any>[] }[] = [
      { logic: 'and', conditions: [] },
    ];
    let currentLogic: 'and' | 'or' = 'and';

    for (const item of filters) {
      if (typeof item === 'string') {
        const newLogic = item.toLowerCase() as 'and' | 'or';
        if (newLogic !== currentLogic) {
          currentLogic = newLogic;
          logicGroups.push({ logic: currentLogic, conditions: [] });
        }
      } else if (Array.isArray(item)) {
        const [field, operator, value] = item;
        const cond = this.convertConditionToMongo(field, operator, value);
        if (cond) logicGroups[logicGroups.length - 1].conditions.push(cond);
      }
    }

    const allConditions: Record<string, any>[] = [];
    for (const group of logicGroups) {
      if (group.conditions.length === 0) continue;
      if (group.conditions.length === 1) {
        allConditions.push(group.conditions[0]);
      } else {
        const op = group.logic === 'or' ? '$or' : '$and';
        allConditions.push({ [op]: group.conditions });
      }
    }

    if (allConditions.length === 0) return {};
    if (allConditions.length === 1) return allConditions[0];
    return { $and: allConditions };
  }

  /**
   * Convert a single ObjectQL condition to MongoDB operator format.
   */
  private convertConditionToMongo(field: string, operator: string, value: any): Record<string, any> | null {
    switch (operator) {
      case '=': case '==':
        return { [field]: value };
      case '!=': case '<>':
        return { [field]: { $ne: value } };
      case '>':
        return { [field]: { $gt: value } };
      case '>=':
        return { [field]: { $gte: value } };
      case '<':
        return { [field]: { $lt: value } };
      case '<=':
        return { [field]: { $lte: value } };
      case 'in':
        return { [field]: { $in: value } };
      case 'nin': case 'not in':
        return { [field]: { $nin: value } };
      case 'contains': case 'like':
        return { [field]: { $regex: new RegExp(this.escapeRegex(value), 'i') } };
      case 'startswith': case 'starts_with':
        return { [field]: { $regex: new RegExp(`^${this.escapeRegex(value)}`, 'i') } };
      case 'endswith': case 'ends_with':
        return { [field]: { $regex: new RegExp(`${this.escapeRegex(value)}$`, 'i') } };
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          return { [field]: { $gte: value[0], $lte: value[1] } };
        }
        return null;
      default:
        return null;
    }
  }

  /**
   * Escape special regex characters for safe literal matching.
   */
  private escapeRegex(str: string): string {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ===================================
  // Aggregation Logic
  // ===================================

  private performAggregation(records: any[], query: QueryInput): any[] {
    const { groupBy, aggregations } = query;
    const groups: Map<string, any[]> = new Map();

    // 1. Group records
    if (groupBy && groupBy.length > 0) {
        for (const record of records) {
            // Create a composite key from group values
            const keyParts = groupBy.map(field => {
                const val = getValueByPath(record, field);
                return val === undefined || val === null ? 'null' : String(val);
            });
            const key = JSON.stringify(keyParts);
            
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(record);
        }
    } else {
        groups.set('all', records);
    }

    // 2. Compute aggregates for each group
    const resultRows: any[] = [];
    
    for (const [_key, groupRecords] of groups.entries()) {
        const row: any = {};
        
        // A. Add Group fields to row (if groupBy exists)
        if (groupBy && groupBy.length > 0) {
             if (groupRecords.length > 0) {
                const firstRecord = groupRecords[0];
                for (const field of groupBy) {
                     this.setValueByPath(row, field, getValueByPath(firstRecord, field));
                }
             }
        }
        
        // B. Compute Aggregations
        if (aggregations) {
            for (const agg of aggregations) {
                 const value = this.computeAggregate(groupRecords, agg);
                 row[agg.alias] = value;
            }
        }
        
        resultRows.push(row);
    }
    
    return resultRows;
  }
  
  private computeAggregate(records: any[], agg: any): any {
      const { function: func, field } = agg;
      
      const values = field ? records.map(r => getValueByPath(r, field)) : [];
      
      switch (func) {
          case 'count':
              if (!field || field === '*') return records.length;
              return values.filter(v => v !== null && v !== undefined).length;
              
          case 'sum':
          case 'avg': {
              const nums = values.filter(v => typeof v === 'number');
              const sum = nums.reduce((a, b) => a + b, 0);
              if (func === 'sum') return sum;
              return nums.length > 0 ? sum / nums.length : null;
          }
              
          case 'min': {
              // Handle comparable values
              const valid = values.filter(v => v !== null && v !== undefined);
              if (valid.length === 0) return null;
              // Works for numbers and strings
              return valid.reduce((min, v) => (v < min ? v : min), valid[0]);
          }

          case 'max': {
              const valid = values.filter(v => v !== null && v !== undefined);
              if (valid.length === 0) return null;
              return valid.reduce((max, v) => (v > max ? v : max), valid[0]);
          }

          default:
              return null;
      }
  }

  private setValueByPath(obj: any, path: string, value: any) {
      const parts = path.split('.');
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current[part]) current[part] = {};
          current = current[part];
      }
      current[parts[parts.length - 1]] = value;
  }

  // ===================================
  // Schema Management
  // ===================================

  async syncSchema(object: string, schema: any, options?: DriverOptions) {
    if (!this.db[object]) {
      this.db[object] = [];
      this.logger.info('Created in-memory table', { object });
    }
  }

  async dropTable(object: string, options?: DriverOptions) {
    if (this.db[object]) {
      const recordCount = this.db[object].length;
      delete this.db[object];
      this.logger.info('Dropped in-memory table', { object, recordCount });
    }
  }

  // ===================================
  // Helpers
  // ===================================

  /**
   * Apply manual sorting (Mingo sort has CJS build issues).
   */
  private applySort(records: any[], sortFields: any[]): any[] {
    const sorted = [...records];
    for (let i = sortFields.length - 1; i >= 0; i--) {
      const sortItem = sortFields[i];
      let field: string;
      let direction: string;
      if (typeof sortItem === 'object' && !Array.isArray(sortItem)) {
        field = sortItem.field;
        direction = sortItem.order || sortItem.direction || 'asc';
      } else if (Array.isArray(sortItem)) {
        [field, direction] = sortItem;
      } else {
        continue;
      }
      sorted.sort((a, b) => {
        const aVal = getValueByPath(a, field);
        const bVal = getValueByPath(b, field);
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal < bVal) return direction === 'desc' ? 1 : -1;
        if (aVal > bVal) return direction === 'desc' ? -1 : 1;
        return 0;
      });
    }
    return sorted;
  }

  /**
   * Project specific fields from a record.
   */
  private projectFields(record: any, fields: string[]): any {
    const result: any = {};
    for (const field of fields) {
      const value = getValueByPath(record, field);
      if (value !== undefined) {
        result[field] = value;
      }
    }
    // Always include id if not explicitly listed
    if (!fields.includes('id') && record.id !== undefined) {
      result.id = record.id;
    }
    return result;
  }

  private getTable(name: string) {
    if (!this.db[name]) {
      this.db[name] = [];
    }
    return this.db[name];
  }

  private generateId(objectName?: string) {
    const key = objectName || '_global';
    const counter = (this.idCounters.get(key) || 0) + 1;
    this.idCounters.set(key, counter);
    const timestamp = Date.now();
    return `${key}-${timestamp}-${counter}`;
  }

  // ===================================
  // Persistence
  // ===================================

  /**
   * Mark the database as dirty, triggering persistence save.
   */
  private markDirty(): void {
    if (this.persistenceAdapter) {
      this.persistenceAdapter.save(this.db);
    }
  }

  /**
   * Flush pending persistence writes to ensure data is safely stored.
   */
  async flush(): Promise<void> {
    if (this.persistenceAdapter) {
      await this.persistenceAdapter.flush();
    }
  }

  /**
   * Initialize the persistence adapter based on configuration.
   */
  private async initPersistence(): Promise<void> {
    const persistence = this.config.persistence;
    if (!persistence) return;

    if (typeof persistence === 'string') {
      if (persistence === 'file') {
        const { FileSystemPersistenceAdapter } = await import('./persistence/file-adapter.js');
        this.persistenceAdapter = new FileSystemPersistenceAdapter();
      } else if (persistence === 'local') {
        const { LocalStoragePersistenceAdapter } = await import('./persistence/local-storage-adapter.js');
        this.persistenceAdapter = new LocalStoragePersistenceAdapter();
      } else {
        throw new Error(`Unknown persistence type: "${persistence}". Use 'file' or 'local'.`);
      }
    } else if ('adapter' in persistence && persistence.adapter) {
      this.persistenceAdapter = persistence.adapter;
    } else if ('type' in persistence) {
      if (persistence.type === 'file') {
        const { FileSystemPersistenceAdapter } = await import('./persistence/file-adapter.js');
        this.persistenceAdapter = new FileSystemPersistenceAdapter({
          path: persistence.path,
          autoSaveInterval: persistence.autoSaveInterval,
        });
      } else if (persistence.type === 'local') {
        const { LocalStoragePersistenceAdapter } = await import('./persistence/local-storage-adapter.js');
        this.persistenceAdapter = new LocalStoragePersistenceAdapter({
          key: persistence.key,
        });
      }
    }

    if (this.persistenceAdapter) {
      this.logger.debug('Persistence adapter initialized');
    }
  }
}
