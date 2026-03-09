// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IDataEngine } from '@objectstack/core';
import type { CleanedWhere } from 'better-auth/adapters';
import { SystemObjectName } from '@objectstack/spec/system';

/**
 * Mapping from better-auth model names to ObjectStack protocol object names.
 *
 * better-auth uses hardcoded model names ('user', 'session', 'account', 'verification')
 * while ObjectStack's protocol layer uses `sys_` prefixed names. This map bridges the two.
 */
export const AUTH_MODEL_TO_PROTOCOL: Record<string, string> = {
  user: SystemObjectName.USER,
  session: SystemObjectName.SESSION,
  account: SystemObjectName.ACCOUNT,
  verification: SystemObjectName.VERIFICATION,
};

/**
 * Resolve a better-auth model name to the ObjectStack protocol object name.
 * Falls back to the original model name for custom / non-core models.
 */
export function resolveProtocolName(model: string): string {
  return AUTH_MODEL_TO_PROTOCOL[model] ?? model;
}

/**
 * Convert a camelCase string to snake_case.
 * Single-word or already snake_case strings pass through unchanged.
 *
 * @example toSnakeCase('providerId') // 'provider_id'
 * @example toSnakeCase('id')         // 'id'
 */
export function toSnakeCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/**
 * Convert a snake_case string to camelCase.
 * Single-word or already camelCase strings pass through unchanged.
 *
 * @example toCamelCase('provider_id') // 'providerId'
 * @example toCamelCase('id')          // 'id'
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

/**
 * Convert all top-level keys of a record from camelCase to snake_case.
 */
function convertKeysToSnake<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    result[toSnakeCase(key)] = obj[key];
  }
  return result;
}

/**
 * Convert all top-level keys of a record from snake_case to camelCase.
 */
function convertKeysToCamel<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    result[toCamelCase(key)] = obj[key];
  }
  return result;
}

/**
 * ObjectQL Adapter for better-auth
 * 
 * Bridges better-auth's database adapter interface with ObjectQL's IDataEngine.
 * This allows better-auth to use ObjectQL for data persistence instead of
 * third-party ORMs like drizzle-orm.
 * 
 * Model names from better-auth (e.g. 'user') are automatically mapped to
 * ObjectStack protocol names (e.g. 'sys_user') via {@link AUTH_MODEL_TO_PROTOCOL}.
 * 
 * Field names are automatically converted between camelCase (better-auth) and
 * snake_case (ObjectStack protocol) in both directions.
 * 
 * @param dataEngine - ObjectQL data engine instance
 * @returns better-auth CustomAdapter
 */
export function createObjectQLAdapter(dataEngine: IDataEngine) {
  /**
   * Convert better-auth where clause to ObjectQL query format.
   * Field names are converted from camelCase to snake_case.
   */
  function convertWhere(where: CleanedWhere[]): Record<string, any> {
    const filter: Record<string, any> = {};
    
    for (const condition of where) {
      const fieldName = toSnakeCase(condition.field);
      
      if (condition.operator === 'eq') {
        filter[fieldName] = condition.value;
      } else if (condition.operator === 'ne') {
        filter[fieldName] = { $ne: condition.value };
      } else if (condition.operator === 'in') {
        filter[fieldName] = { $in: condition.value };
      } else if (condition.operator === 'gt') {
        filter[fieldName] = { $gt: condition.value };
      } else if (condition.operator === 'gte') {
        filter[fieldName] = { $gte: condition.value };
      } else if (condition.operator === 'lt') {
        filter[fieldName] = { $lt: condition.value };
      } else if (condition.operator === 'lte') {
        filter[fieldName] = { $lte: condition.value };
      } else if (condition.operator === 'contains') {
        filter[fieldName] = { $regex: condition.value };
      }
    }
    
    return filter;
  }

  return {
    create: async <T extends Record<string, any>>({ model, data, select: _select }: { model: string; data: T; select?: string[] }): Promise<T> => {
      const objectName = resolveProtocolName(model);
      
      // Note: select parameter is currently not supported by ObjectQL's insert operation
      // The full record is always returned after insertion
      const snakeData = convertKeysToSnake(data);
      const result = await dataEngine.insert(objectName, snakeData);
      return convertKeysToCamel(result) as T;
    },
    
    findOne: async <T>({ model, where, select, join: _join }: { model: string; where: CleanedWhere[]; select?: string[]; join?: any }): Promise<T | null> => {
      const objectName = resolveProtocolName(model);
      const filter = convertWhere(where);
      const snakeSelect = select ? select.map(toSnakeCase) : undefined;
      
      // Note: join parameter is not currently supported by ObjectQL's findOne operation
      // Joins/populate functionality is planned for future ObjectQL releases
      // For now, related data must be fetched separately
      
      const result = await dataEngine.findOne(objectName, {
        filter,
        select: snakeSelect,
      });
      
      return result ? convertKeysToCamel(result) as T : null;
    },
    
    findMany: async <T>({ model, where, limit, offset, sortBy, join: _join }: { model: string; where?: CleanedWhere[]; limit: number; offset?: number; sortBy?: { field: string; direction: 'asc' | 'desc' }; join?: any }): Promise<T[]> => {
      const objectName = resolveProtocolName(model);
      const filter = where ? convertWhere(where) : {};
      
      // Note: join parameter is not currently supported by ObjectQL's find operation
      // Joins/populate functionality is planned for future ObjectQL releases
      
      const sort = sortBy ? [{
        field: toSnakeCase(sortBy.field),
        order: sortBy.direction as 'asc' | 'desc',
      }] : undefined;
      
      const results = await dataEngine.find(objectName, {
        filter,
        limit: limit || 100,
        skip: offset,
        sort,
      });
      
      return results.map(r => convertKeysToCamel(r)) as T[];
    },
    
    count: async ({ model, where }: { model: string; where?: CleanedWhere[] }): Promise<number> => {
      const objectName = resolveProtocolName(model);
      const filter = where ? convertWhere(where) : {};
      
      return await dataEngine.count(objectName, { filter });
    },
    
    update: async <T>({ model, where, update }: { model: string; where: CleanedWhere[]; update: Record<string, any> }): Promise<T | null> => {
      const objectName = resolveProtocolName(model);
      const filter = convertWhere(where);
      
      // Find the record first to get its ID
      const record = await dataEngine.findOne(objectName, { filter });
      if (!record) {
        return null;
      }
      
      const snakeUpdate = convertKeysToSnake(update);
      const result = await dataEngine.update(objectName, {
        ...snakeUpdate,
        id: record.id,
      });
      
      return result ? convertKeysToCamel(result) as T : null;
    },
    
    updateMany: async ({ model, where, update }: { model: string; where: CleanedWhere[]; update: Record<string, any> }): Promise<number> => {
      const objectName = resolveProtocolName(model);
      const filter = convertWhere(where);
      const snakeUpdate = convertKeysToSnake(update);
      
      // Note: Sequential updates are used here because ObjectQL's IDataEngine interface
      // requires an ID for updates. A future optimization could use a bulk update
      // operation if ObjectQL adds support for filter-based updates without IDs.
      
      // Find all matching records
      const records = await dataEngine.find(objectName, { filter });
      
      // Update each record
      for (const record of records) {
        await dataEngine.update(objectName, {
          ...snakeUpdate,
          id: record.id,
        });
      }
      
      return records.length;
    },
    
    delete: async ({ model, where }: { model: string; where: CleanedWhere[] }): Promise<void> => {
      const objectName = resolveProtocolName(model);
      const filter = convertWhere(where);
      
      // Note: We need to find the record first to get its ID because ObjectQL's
      // delete operation requires an ID. Direct filter-based delete would be more
      // efficient if supported by ObjectQL in the future.
      const record = await dataEngine.findOne(objectName, { filter });
      if (!record) {
        return;
      }
      
      await dataEngine.delete(objectName, { filter: { id: record.id } });
    },
    
    deleteMany: async ({ model, where }: { model: string; where: CleanedWhere[] }): Promise<number> => {
      const objectName = resolveProtocolName(model);
      const filter = convertWhere(where);
      
      // Note: Sequential deletes are used here because ObjectQL's delete operation
      // requires an ID in the filter. A future optimization could use a single
      // delete call with the original filter if ObjectQL supports it.
      
      // Find all matching records
      const records = await dataEngine.find(objectName, { filter });
      
      // Delete each record
      for (const record of records) {
        await dataEngine.delete(objectName, { filter: { id: record.id } });
      }
      
      return records.length;
    },
  };
}
