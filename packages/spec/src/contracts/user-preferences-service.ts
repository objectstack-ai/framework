// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { UserPreferenceEntry, FavoriteEntry, FavoritesValue, RecentItemsValue } from '../identity/user-preference.zod';

/**
 * IUserPreferencesService — User Preferences Service Contract
 *
 * Defines the interface for managing user preferences in ObjectStack.
 * Supports both scalar preferences (theme, locale) and structured data (favorites, recent_items).
 *
 * Follows Dependency Inversion Principle — plugins depend on this interface,
 * not on concrete implementations.
 *
 * Aligns with CoreServiceName 'user-preferences' in core-services.zod.ts.
 *
 * @example
 * ```ts
 * const prefs = ctx.getService<IUserPreferencesService>('user-preferences');
 *
 * // Get a scalar preference
 * const theme = await prefs.get('user123', 'theme'); // => 'dark'
 *
 * // Set a scalar preference
 * await prefs.set('user123', 'theme', 'light');
 *
 * // Get structured data (favorites)
 * const favorites = await prefs.get<FavoritesValue>('user123', 'favorites');
 *
 * // Set multiple preferences at once
 * await prefs.setMany('user123', {
 *   theme: 'dark',
 *   locale: 'en-US',
 *   sidebar_collapsed: true,
 * });
 *
 * // Get all preferences for a user
 * const allPrefs = await prefs.getAll('user123');
 *
 * // Delete a preference
 * await prefs.delete('user123', 'theme');
 *
 * // Query preferences by prefix
 * const aiPrefs = await prefs.getAll('user123', { prefix: 'plugin.ai.' });
 * ```
 */
export interface IUserPreferencesService {
  /**
   * Get a user preference value by key
   *
   * @param userId - User ID
   * @param key - Preference key (well-known or custom)
   * @returns The preference value, or undefined if not set
   */
  get<T = unknown>(userId: string, key: string): Promise<T | undefined>;

  /**
   * Set a user preference value
   *
   * @param userId - User ID
   * @param key - Preference key
   * @param value - Preference value (JSON-serializable)
   */
  set(userId: string, key: string, value: unknown): Promise<void>;

  /**
   * Set multiple user preferences at once (batch operation)
   *
   * @param userId - User ID
   * @param preferences - Key-value pairs to set
   */
  setMany(userId: string, preferences: Record<string, unknown>): Promise<void>;

  /**
   * Delete a user preference by key
   *
   * @param userId - User ID
   * @param key - Preference key to delete
   * @returns True if the preference was deleted, false if it didn't exist
   */
  delete(userId: string, key: string): Promise<boolean>;

  /**
   * Get all user preferences (optionally filtered by key prefix)
   *
   * @param userId - User ID
   * @param options - Query options (prefix filter, etc.)
   * @returns Key-value pairs of all matching preferences
   */
  getAll(userId: string, options?: { prefix?: string }): Promise<Record<string, unknown>>;

  /**
   * Check if a preference key exists for a user
   *
   * @param userId - User ID
   * @param key - Preference key
   * @returns True if the preference exists
   */
  has(userId: string, key: string): Promise<boolean>;

  /**
   * Clear all preferences for a user (or matching a prefix)
   *
   * @param userId - User ID
   * @param options - Query options (prefix filter, etc.)
   */
  clear(userId: string, options?: { prefix?: string }): Promise<void>;

  /**
   * Get all preference entries for a user (full schema, including metadata)
   *
   * @param userId - User ID
   * @param options - Query options (prefix filter, etc.)
   * @returns Array of UserPreferenceEntry objects
   */
  listEntries(userId: string, options?: { prefix?: string }): Promise<UserPreferenceEntry[]>;
}

/**
 * IUserFavoritesService — User Favorites Service Contract
 *
 * Specialized service for managing user favorites.
 * This is a convenience layer on top of IUserPreferencesService.
 *
 * Favorites are stored as a structured preference with key 'favorites'.
 *
 * @example
 * ```ts
 * const favorites = ctx.getService<IUserFavoritesService>('user-favorites');
 *
 * // Add a favorite
 * await favorites.add('user123', {
 *   type: 'view',
 *   target: 'kanban_tasks',
 *   label: 'My Tasks',
 *   icon: 'kanban',
 * });
 *
 * // List all favorites
 * const items = await favorites.list('user123');
 *
 * // Remove a favorite
 * await favorites.remove('user123', 'favorite_id_123');
 *
 * // Check if an item is favorited
 * const isFav = await favorites.has('user123', 'view', 'kanban_tasks');
 * ```
 */
export interface IUserFavoritesService {
  /**
   * List all favorites for a user
   *
   * @param userId - User ID
   * @returns Array of favorite entries
   */
  list(userId: string): Promise<FavoriteEntry[]>;

  /**
   * Add a new favorite
   *
   * @param userId - User ID
   * @param entry - Favorite entry (without id and createdAt, which are auto-generated)
   * @returns The created favorite entry with id and createdAt
   */
  add(userId: string, entry: Omit<FavoriteEntry, 'id' | 'createdAt'>): Promise<FavoriteEntry>;

  /**
   * Remove a favorite by ID
   *
   * @param userId - User ID
   * @param favoriteId - Favorite entry ID
   * @returns True if the favorite was removed, false if it didn't exist
   */
  remove(userId: string, favoriteId: string): Promise<boolean>;

  /**
   * Check if an item is in the user's favorites
   *
   * @param userId - User ID
   * @param type - Item type
   * @param target - Item target reference
   * @returns True if the item is favorited
   */
  has(userId: string, type: string, target: string): Promise<boolean>;

  /**
   * Toggle a favorite (add if not exists, remove if exists)
   *
   * @param userId - User ID
   * @param entry - Favorite entry to toggle
   * @returns True if added, false if removed
   */
  toggle(userId: string, entry: Omit<FavoriteEntry, 'id' | 'createdAt'>): Promise<boolean>;
}
