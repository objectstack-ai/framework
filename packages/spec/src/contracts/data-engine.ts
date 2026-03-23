// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { 
  DataEngineQueryOptions, 
  DataEngineInsertOptions, 
  DataEngineUpdateOptions, 
  DataEngineDeleteOptions,
  DataEngineAggregateOptions, 
  DataEngineCountOptions,
  DataEngineRequest,
} from '../data/index.js';

import type { IDataDriver } from './data-driver.js';

/**
 * IDataEngine - Standard Data Engine Interface
 * 
 * Abstract interface for data persistence capabilities.
 * Following the Dependency Inversion Principle - plugins depend on this interface,
 * not on concrete database implementations.
 * 
 * Aligned with 'src/data/data-engine.zod.ts' in @objectstack/spec.
 */

export interface IDataEngine {
  find(objectName: string, query?: DataEngineQueryOptions): Promise<any[]>;
  findOne(objectName: string, query?: DataEngineQueryOptions): Promise<any>;
  insert(objectName: string, data: any | any[], options?: DataEngineInsertOptions): Promise<any>;
  update(objectName: string, data: any, options?: DataEngineUpdateOptions): Promise<any>;
  delete(objectName: string, options?: DataEngineDeleteOptions): Promise<any>;
  count(objectName: string, query?: DataEngineCountOptions): Promise<number>;
  aggregate(objectName: string, query: DataEngineAggregateOptions): Promise<any[]>;
  
  /**
   * Vector Search (AI/RAG)
   */
  vectorFind?(objectName: string, vector: number[], options?: { filter?: any, limit?: number, select?: string[], threshold?: number }): Promise<any[]>;

  /**
   * Batch Operations (Transactional)
   */
  batch?(requests: DataEngineRequest[], options?: { transaction?: boolean }): Promise<any[]>;

  /**
   * Execute raw command (Escape hatch)
   */
  execute?(command: any, options?: Record<string, any>): Promise<any>;
}

/**
 * @deprecated Use `IDataDriver` from `@objectstack/spec/contracts` instead.
 * `DriverInterface` is now a type alias for `IDataDriver` — the single authoritative
 * driver contract. All new driver implementations should use `IDataDriver` directly.
 *
 * @see IDataDriver in data-driver.ts for the full contract specification.
 */
export type DriverInterface = IDataDriver;
