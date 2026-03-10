// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IDataEngine } from '@objectstack/core';
import { createAdapterFactory } from 'better-auth/adapters';
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert better-auth where clause to ObjectQL query format.
 *
 * Field names in the incoming {@link CleanedWhere} are expected to already be
 * in snake_case (transformed by `createAdapterFactory`).
 */
function convertWhere(where: CleanedWhere[]): Record<string, any> {
  const filter: Record<string, any> = {};

  for (const condition of where) {
    const fieldName = condition.field;

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

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

/**
 * Create an ObjectQL adapter **factory** for better-auth.
 *
 * Uses better-auth's official `createAdapterFactory` so that model-name and
 * field-name transformations (declared via `modelName` / `fields` in the
 * betterAuth config) are applied **automatically** before any data reaches
 * ObjectQL. This eliminates the need for manual camelCase ↔ snake_case
 * conversion inside the adapter.
 *
 * The returned value is an `AdapterFactory` – a function of type
 * `(options: BetterAuthOptions) => DBAdapter` – which is the shape expected
 * by `betterAuth({ database: … })`.
 *
 * @param dataEngine - ObjectQL data engine instance
 * @returns better-auth AdapterFactory
 */
export function createObjectQLAdapterFactory(dataEngine: IDataEngine) {
  return createAdapterFactory({
    config: {
      adapterId: 'objectql',
      // ObjectQL natively supports these types — no extra conversion needed
      supportsBooleans: true,
      supportsDates: true,
      supportsJSON: true,
    },
    adapter: () => ({
      create: async <T extends Record<string, any>>(
        { model, data, select: _select }: { model: string; data: T; select?: string[] },
      ): Promise<T> => {
        const result = await dataEngine.insert(model, data);
        return result as T;
      },

      findOne: async <T>(
        { model, where, select, join: _join }: { model: string; where: CleanedWhere[]; select?: string[]; join?: any },
      ): Promise<T | null> => {
        const filter = convertWhere(where);

        const result = await dataEngine.findOne(model, { filter, select });

        return result ? (result as T) : null;
      },

      findMany: async <T>(
        { model, where, limit, offset, sortBy, join: _join }: {
          model: string; where?: CleanedWhere[]; limit: number;
          offset?: number; sortBy?: { field: string; direction: 'asc' | 'desc' }; join?: any;
        },
      ): Promise<T[]> => {
        const filter = where ? convertWhere(where) : {};

        const sort = sortBy
          ? [{ field: sortBy.field, order: sortBy.direction as 'asc' | 'desc' }]
          : undefined;

        const results = await dataEngine.find(model, {
          filter,
          limit: limit || 100,
          skip: offset,
          sort,
        });

        return results as T[];
      },

      count: async (
        { model, where }: { model: string; where?: CleanedWhere[] },
      ): Promise<number> => {
        const filter = where ? convertWhere(where) : {};
        return await dataEngine.count(model, { filter });
      },

      update: async <T>(
        { model, where, update }: { model: string; where: CleanedWhere[]; update: T },
      ): Promise<T | null> => {
        const filter = convertWhere(where);

        // ObjectQL requires an ID for updates – find the record first
        const record = await dataEngine.findOne(model, { filter });
        if (!record) return null;

        const result = await dataEngine.update(model, { ...(update as any), id: record.id });
        return result ? (result as T) : null;
      },

      updateMany: async (
        { model, where, update }: { model: string; where: CleanedWhere[]; update: Record<string, any> },
      ): Promise<number> => {
        const filter = convertWhere(where);

        // Sequential updates: ObjectQL requires an ID per update
        const records = await dataEngine.find(model, { filter });
        for (const record of records) {
          await dataEngine.update(model, { ...update, id: record.id });
        }
        return records.length;
      },

      delete: async (
        { model, where }: { model: string; where: CleanedWhere[] },
      ): Promise<void> => {
        const filter = convertWhere(where);

        const record = await dataEngine.findOne(model, { filter });
        if (!record) return;

        await dataEngine.delete(model, { filter: { id: record.id } });
      },

      deleteMany: async (
        { model, where }: { model: string; where: CleanedWhere[] },
      ): Promise<number> => {
        const filter = convertWhere(where);

        const records = await dataEngine.find(model, { filter });
        for (const record of records) {
          await dataEngine.delete(model, { filter: { id: record.id } });
        }
        return records.length;
      },
    }),
  });
}

// ---------------------------------------------------------------------------
// Legacy adapter (kept for backward compatibility)
// ---------------------------------------------------------------------------

/**
 * Create a raw ObjectQL adapter for better-auth (without factory wrapping).
 *
 * > **Prefer {@link createObjectQLAdapterFactory}** for production use.
 * > The factory version leverages `createAdapterFactory` and automatically
 * > handles model-name + field-name transformations declared in the
 * > better-auth config.
 *
 * This function is retained for direct / low-level usage where callers
 * manage field-name conversion themselves.
 *
 * @param dataEngine - ObjectQL data engine instance
 * @returns better-auth CustomAdapter (raw, without factory wrapping)
 */
export function createObjectQLAdapter(dataEngine: IDataEngine) {
  return {
    create: async <T extends Record<string, any>>({ model, data, select: _select }: { model: string; data: T; select?: string[] }): Promise<T> => {
      const objectName = resolveProtocolName(model);
      const result = await dataEngine.insert(objectName, data);
      return result as T;
    },

    findOne: async <T>({ model, where, select, join: _join }: { model: string; where: CleanedWhere[]; select?: string[]; join?: any }): Promise<T | null> => {
      const objectName = resolveProtocolName(model);
      const filter = convertWhere(where);
      const result = await dataEngine.findOne(objectName, { filter, select });
      return result ? result as T : null;
    },

    findMany: async <T>({ model, where, limit, offset, sortBy, join: _join }: { model: string; where?: CleanedWhere[]; limit: number; offset?: number; sortBy?: { field: string; direction: 'asc' | 'desc' }; join?: any }): Promise<T[]> => {
      const objectName = resolveProtocolName(model);
      const filter = where ? convertWhere(where) : {};
      const sort = sortBy ? [{ field: sortBy.field, order: sortBy.direction as 'asc' | 'desc' }] : undefined;
      const results = await dataEngine.find(objectName, { filter, limit: limit || 100, skip: offset, sort });
      return results as T[];
    },

    count: async ({ model, where }: { model: string; where?: CleanedWhere[] }): Promise<number> => {
      const objectName = resolveProtocolName(model);
      const filter = where ? convertWhere(where) : {};
      return await dataEngine.count(objectName, { filter });
    },

    update: async <T>({ model, where, update }: { model: string; where: CleanedWhere[]; update: Record<string, any> }): Promise<T | null> => {
      const objectName = resolveProtocolName(model);
      const filter = convertWhere(where);
      const record = await dataEngine.findOne(objectName, { filter });
      if (!record) return null;
      const result = await dataEngine.update(objectName, { ...update, id: record.id });
      return result ? result as T : null;
    },

    updateMany: async ({ model, where, update }: { model: string; where: CleanedWhere[]; update: Record<string, any> }): Promise<number> => {
      const objectName = resolveProtocolName(model);
      const filter = convertWhere(where);
      const records = await dataEngine.find(objectName, { filter });
      for (const record of records) {
        await dataEngine.update(objectName, { ...update, id: record.id });
      }
      return records.length;
    },

    delete: async ({ model, where }: { model: string; where: CleanedWhere[] }): Promise<void> => {
      const objectName = resolveProtocolName(model);
      const filter = convertWhere(where);
      const record = await dataEngine.findOne(objectName, { filter });
      if (!record) return;
      await dataEngine.delete(objectName, { filter: { id: record.id } });
    },

    deleteMany: async ({ model, where }: { model: string; where: CleanedWhere[] }): Promise<number> => {
      const objectName = resolveProtocolName(model);
      const filter = convertWhere(where);
      const records = await dataEngine.find(objectName, { filter });
      for (const record of records) {
        await dataEngine.delete(objectName, { filter: { id: record.id } });
      }
      return records.length;
    },
  };
}
