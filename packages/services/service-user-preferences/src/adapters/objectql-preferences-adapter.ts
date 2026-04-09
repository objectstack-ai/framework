// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { randomUUID } from 'node:crypto';
import type {
  IUserPreferencesService,
  IDataEngine,
} from '@objectstack/spec/contracts';
import type { UserPreferenceEntry } from '@objectstack/spec/identity';

/** Object name used for persistence. */
const USER_PREFERENCES_OBJECT = 'user_preferences';

/** Database row shape for user_preferences. */
interface DbUserPreferenceRow {
  id: string;
  user_id: string;
  key: string;
  value: string | null;
  value_type: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * ObjectQLUserPreferencesService — Persistent implementation of IUserPreferencesService.
 *
 * Delegates all storage to an {@link IDataEngine} instance, using the
 * `user_preferences` object. This decouples the service from any specific
 * database driver (Turso, Postgres, SQLite, etc.).
 *
 * Production environments should use this implementation to ensure
 * preferences persist across service restarts.
 */
export class ObjectQLUserPreferencesService implements IUserPreferencesService {
  private readonly engine: IDataEngine;

  constructor(engine: IDataEngine) {
    this.engine = engine;
  }

  async get<T = unknown>(userId: string, key: string): Promise<T | undefined> {
    const row: DbUserPreferenceRow | null = await this.engine.findOne(USER_PREFERENCES_OBJECT, {
      where: { user_id: userId, key },
    });

    if (!row || row.value === null) return undefined;

    return this.deserializeValue<T>(row.value);
  }

  async set(userId: string, key: string, value: unknown): Promise<void> {
    const now = new Date().toISOString();

    // Check if preference already exists
    const existing: DbUserPreferenceRow | null = await this.engine.findOne(USER_PREFERENCES_OBJECT, {
      where: { user_id: userId, key },
      fields: ['id'],
    });

    const serializedValue = this.serializeValue(value);
    const valueType = this.detectValueType(value);

    if (existing) {
      // Update existing preference
      await this.engine.update(USER_PREFERENCES_OBJECT, {
        id: existing.id,
        value: serializedValue,
        value_type: valueType,
        updated_at: now,
      }, {
        where: { id: existing.id },
      });
    } else {
      // Insert new preference
      const id = `pref_${randomUUID()}`;
      await this.engine.insert(USER_PREFERENCES_OBJECT, {
        id,
        user_id: userId,
        key,
        value: serializedValue,
        value_type: valueType,
        created_at: now,
        updated_at: now,
      });
    }
  }

  async setMany(userId: string, preferences: Record<string, unknown>): Promise<void> {
    const now = new Date().toISOString();

    // Get all existing preferences for this user in a single query
    const existingRows: DbUserPreferenceRow[] = await this.engine.find(USER_PREFERENCES_OBJECT, {
      where: { user_id: userId },
      fields: ['id', 'key'],
    });

    const existingMap = new Map(existingRows.map(row => [row.key, row.id]));

    // Prepare batch updates and inserts
    const updates: Array<{ id: string; value: string; value_type: string; updated_at: string }> = [];
    const inserts: DbUserPreferenceRow[] = [];

    for (const [key, value] of Object.entries(preferences)) {
      const serializedValue = this.serializeValue(value);
      const valueType = this.detectValueType(value);

      const existingId = existingMap.get(key);
      if (existingId) {
        // Update
        updates.push({
          id: existingId,
          value: serializedValue,
          value_type: valueType,
          updated_at: now,
        });
      } else {
        // Insert
        inserts.push({
          id: `pref_${randomUUID()}`,
          user_id: userId,
          key,
          value: serializedValue,
          value_type: valueType,
          created_at: now,
          updated_at: now,
        });
      }
    }

    // Execute batch operations
    if (updates.length > 0) {
      // Update each one (ObjectQL doesn't guarantee batch update support)
      await Promise.all(
        updates.map(update =>
          this.engine.update(USER_PREFERENCES_OBJECT, update, {
            where: { id: update.id },
          })
        )
      );
    }

    if (inserts.length > 0) {
      await this.engine.insert(USER_PREFERENCES_OBJECT, inserts);
    }
  }

  async delete(userId: string, key: string): Promise<boolean> {
    const existing: DbUserPreferenceRow | null = await this.engine.findOne(USER_PREFERENCES_OBJECT, {
      where: { user_id: userId, key },
      fields: ['id'],
    });

    if (!existing) return false;

    await this.engine.delete(USER_PREFERENCES_OBJECT, {
      where: { id: existing.id },
    });

    return true;
  }

  async getAll(userId: string, options?: { prefix?: string }): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = { user_id: userId };

    // Apply prefix filter if specified
    if (options?.prefix) {
      // Use SQL LIKE pattern for prefix matching
      where.key = { $like: `${options.prefix}%` };
    }

    const rows: DbUserPreferenceRow[] = await this.engine.find(USER_PREFERENCES_OBJECT, {
      where,
      orderBy: [{ field: 'key', order: 'asc' }],
    });

    const result: Record<string, unknown> = {};
    for (const row of rows) {
      if (row.value !== null) {
        result[row.key] = this.deserializeValue(row.value);
      }
    }

    return result;
  }

  async has(userId: string, key: string): Promise<boolean> {
    const count = await this.engine.count(USER_PREFERENCES_OBJECT, {
      where: { user_id: userId, key },
    });

    return count > 0;
  }

  async clear(userId: string, options?: { prefix?: string }): Promise<void> {
    const where: Record<string, unknown> = { user_id: userId };

    // Apply prefix filter if specified
    if (options?.prefix) {
      where.key = { $like: `${options.prefix}%` };
    }

    await this.engine.delete(USER_PREFERENCES_OBJECT, {
      where,
      multi: true,
    });
  }

  async listEntries(userId: string, options?: { prefix?: string }): Promise<UserPreferenceEntry[]> {
    const where: Record<string, unknown> = { user_id: userId };

    // Apply prefix filter if specified
    if (options?.prefix) {
      where.key = { $like: `${options.prefix}%` };
    }

    const rows: DbUserPreferenceRow[] = await this.engine.find(USER_PREFERENCES_OBJECT, {
      where,
      orderBy: [{ field: 'key', order: 'asc' }],
    });

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      key: row.key,
      value: row.value !== null ? this.deserializeValue(row.value) : null,
      valueType: row.value_type ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Serialize a value to JSON string for storage.
   */
  private serializeValue(value: unknown): string {
    return JSON.stringify(value);
  }

  /**
   * Deserialize a JSON string to its original value.
   */
  private deserializeValue<T = unknown>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      // Fallback to raw string if JSON parsing fails
      return value as T;
    }
  }

  /**
   * Detect the type of a value for the value_type hint.
   */
  private detectValueType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return typeof value; // 'string', 'number', 'boolean'
  }
}
