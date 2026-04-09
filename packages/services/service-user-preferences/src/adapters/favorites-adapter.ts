// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { randomUUID } from 'node:crypto';
import type { IUserFavoritesService, IUserPreferencesService } from '@objectstack/spec/contracts';
import type { FavoriteEntry, FavoritesValue } from '@objectstack/spec/identity';

/**
 * UserFavoritesService — Favorites management service.
 *
 * Implements IUserFavoritesService on top of IUserPreferencesService.
 * Favorites are stored as a structured preference with key 'favorites'.
 */
export class UserFavoritesService implements IUserFavoritesService {
  private readonly preferences: IUserPreferencesService;
  private readonly FAVORITES_KEY = 'favorites';

  constructor(preferences: IUserPreferencesService) {
    this.preferences = preferences;
  }

  async list(userId: string): Promise<FavoriteEntry[]> {
    const favorites = await this.preferences.get<FavoritesValue>(userId, this.FAVORITES_KEY);
    return favorites ?? [];
  }

  async add(userId: string, entry: Omit<FavoriteEntry, 'id' | 'createdAt'>): Promise<FavoriteEntry> {
    const favorites = await this.list(userId);

    // Check for duplicates (same type + target)
    const existing = favorites.find(f => f.type === entry.type && f.target === entry.target);
    if (existing) {
      return existing;
    }

    const newEntry: FavoriteEntry = {
      id: `fav_${randomUUID()}`,
      ...entry,
      createdAt: new Date().toISOString(),
    };

    favorites.push(newEntry);
    await this.preferences.set(userId, this.FAVORITES_KEY, favorites);

    return newEntry;
  }

  async remove(userId: string, favoriteId: string): Promise<boolean> {
    const favorites = await this.list(userId);
    const index = favorites.findIndex(f => f.id === favoriteId);

    if (index === -1) return false;

    favorites.splice(index, 1);
    await this.preferences.set(userId, this.FAVORITES_KEY, favorites);

    return true;
  }

  async has(userId: string, type: string, target: string): Promise<boolean> {
    const favorites = await this.list(userId);
    return favorites.some(f => f.type === type && f.target === target);
  }

  async toggle(userId: string, entry: Omit<FavoriteEntry, 'id' | 'createdAt'>): Promise<boolean> {
    const favorites = await this.list(userId);
    const existingIndex = favorites.findIndex(f => f.type === entry.type && f.target === entry.target);

    if (existingIndex !== -1) {
      // Remove
      favorites.splice(existingIndex, 1);
      await this.preferences.set(userId, this.FAVORITES_KEY, favorites);
      return false;
    } else {
      // Add
      await this.add(userId, entry);
      return true;
    }
  }
}
