// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * User Preference Schema
 *
 * Defines the standard user preferences data model for ObjectStack.
 * Supports both scalar values (theme, locale) and structured data (favorites, recent_items).
 *
 * This is the Zod schema layer. TypeScript types are derived via z.infer<>.
 * Service layer contracts are defined in packages/spec/src/contracts/user-preferences-service.ts.
 */

/**
 * Well-known preference keys
 *
 * These keys are reserved for system-level preferences.
 * Plugins can define custom keys with their own namespace (e.g., 'plugin.ai.auto_save').
 */
export const WellKnownPreferenceKeys = z.enum([
  'theme',              // UI theme: 'light' | 'dark' | 'system'
  'locale',             // User's preferred locale: 'en-US' | 'zh-CN' | etc.
  'timezone',           // User's timezone: 'America/New_York' | 'Asia/Shanghai' | etc.
  'favorites',          // User's favorite items (structured)
  'recent_items',       // User's recently accessed items (structured)
  'sidebar_collapsed',  // UI: whether sidebar is collapsed
  'page_size',          // Default pagination size
]);

export type WellKnownPreferenceKey = z.infer<typeof WellKnownPreferenceKeys>;

/**
 * Favorite Entry Schema
 *
 * Represents a single favorite item (object, view, app, etc.)
 */
export const FavoriteEntrySchema = z.object({
  /**
   * Unique identifier for the favorite entry
   */
  id: z.string().describe('Unique identifier (auto-generated)'),

  /**
   * Type of the favorite item
   */
  type: z.enum(['object', 'view', 'app', 'dashboard', 'report', 'record']).describe('Item type'),

  /**
   * Target reference (object name, view name, app ID, record ID, etc.)
   */
  target: z.string().describe('Target reference (e.g., object name, view name, record ID)'),

  /**
   * Display label (optional override)
   */
  label: z.string().optional().describe('Display label override'),

  /**
   * Icon (optional override)
   */
  icon: z.string().optional().describe('Icon override'),

  /**
   * Custom metadata
   */
  metadata: z.record(z.string(), z.unknown()).optional().describe('Custom metadata'),

  /**
   * Creation timestamp
   */
  createdAt: z.string().datetime().describe('Creation timestamp'),
});

export type FavoriteEntry = z.infer<typeof FavoriteEntrySchema>;

/**
 * Favorites Value Schema
 *
 * The structured value for the 'favorites' preference key.
 * Array of favorite entries.
 */
export const FavoritesValueSchema = z.array(FavoriteEntrySchema);

export type FavoritesValue = z.infer<typeof FavoritesValueSchema>;

/**
 * Recent Item Entry Schema
 *
 * Represents a recently accessed item
 */
export const RecentItemEntrySchema = z.object({
  /**
   * Type of the recent item
   */
  type: z.enum(['object', 'view', 'app', 'dashboard', 'report', 'record']).describe('Item type'),

  /**
   * Target reference (object name, view name, app ID, record ID, etc.)
   */
  target: z.string().describe('Target reference'),

  /**
   * Display label
   */
  label: z.string().optional().describe('Display label'),

  /**
   * Last accessed timestamp
   */
  accessedAt: z.string().datetime().describe('Last accessed timestamp'),

  /**
   * Access count
   */
  accessCount: z.number().int().min(1).default(1).describe('Number of times accessed'),
});

export type RecentItemEntry = z.infer<typeof RecentItemEntrySchema>;

/**
 * Recent Items Value Schema
 *
 * The structured value for the 'recent_items' preference key.
 * Array of recently accessed items, sorted by accessedAt (descending).
 */
export const RecentItemsValueSchema = z.array(RecentItemEntrySchema);

export type RecentItemsValue = z.infer<typeof RecentItemsValueSchema>;

/**
 * User Preference Entry Schema
 *
 * Represents a single user preference key-value pair.
 * This is the core schema used for storage in the database.
 */
export const UserPreferenceEntrySchema = z.object({
  /**
   * Unique identifier (auto-generated)
   */
  id: z.string().describe('Unique identifier'),

  /**
   * User ID who owns this preference
   */
  userId: z.string().describe('User ID'),

  /**
   * Preference key (well-known or custom)
   *
   * Well-known keys: 'theme', 'locale', 'favorites', 'recent_items', etc.
   * Custom keys: 'plugin.ai.auto_save', 'plugin.security.mfa_enabled', etc.
   */
  key: z.string().min(1).describe('Preference key'),

  /**
   * Preference value (JSON-serializable)
   *
   * Scalar types: string, number, boolean, null
   * Structured types: object, array
   */
  value: z.unknown().describe('Preference value (JSON-serializable)'),

  /**
   * Value type hint (optional, for client-side type safety)
   */
  valueType: z.enum(['string', 'number', 'boolean', 'object', 'array', 'null']).optional().describe('Value type hint'),

  /**
   * Creation timestamp
   */
  createdAt: z.string().datetime().describe('Creation timestamp'),

  /**
   * Last update timestamp
   */
  updatedAt: z.string().datetime().describe('Last update timestamp'),
});

export type UserPreferenceEntry = z.infer<typeof UserPreferenceEntrySchema>;

/**
 * User Preference Batch Set Schema
 *
 * Used for batch set operations (setMany).
 */
export const UserPreferenceBatchSetSchema = z.record(
  z.string(), // key
  z.unknown() // value
);

export type UserPreferenceBatchSet = z.infer<typeof UserPreferenceBatchSetSchema>;

/**
 * User Preference Query Options Schema
 *
 * Used for filtering preferences by key prefix.
 */
export const UserPreferenceQueryOptionsSchema = z.object({
  /**
   * Key prefix filter (e.g., 'plugin.ai.' to get all AI plugin preferences)
   */
  prefix: z.string().optional().describe('Key prefix filter'),

  /**
   * User ID filter (for admin queries)
   */
  userId: z.string().optional().describe('User ID filter'),
});

export type UserPreferenceQueryOptions = z.infer<typeof UserPreferenceQueryOptionsSchema>;
