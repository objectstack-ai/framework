// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { I18nLabelSchema } from './i18n.zod';

/**
 * Offline Strategy Schema
 * Determines how data is fetched when connectivity is limited.
 */
import { lazySchema } from '../shared/lazy-schema';
export const OfflineStrategySchema = lazySchema(() => z.enum([
  'cache_first',
  'network_first',
  'stale_while_revalidate',
  'network_only',
  'cache_only',
]).describe('Data fetching strategy for offline/online transitions'));

export type OfflineStrategy = z.infer<typeof OfflineStrategySchema>;

/**
 * Conflict Resolution Strategy Enum
 */
export const ConflictResolutionSchema = lazySchema(() => z.enum([
  'client_wins',
  'server_wins',
  'manual',
  'last_write_wins',
]).describe('How to resolve conflicts when syncing offline changes'));

export type ConflictResolution = z.infer<typeof ConflictResolutionSchema>;

/**
 * Sync Configuration Schema
 * Controls how offline mutations are synchronized with the server.
 */
export const SyncConfigSchema = lazySchema(() => z.object({
  strategy: OfflineStrategySchema.default('network_first').describe('Sync fetch strategy'),
  conflictResolution: ConflictResolutionSchema.default('last_write_wins').describe('Conflict resolution policy'),
  retryInterval: z.number().optional().describe('Retry interval in milliseconds between sync attempts'),
  maxRetries: z.number().optional().describe('Maximum number of sync retry attempts'),
  batchSize: z.number().optional().describe('Number of mutations to sync per batch'),
}).describe('Offline-to-online synchronization configuration'));

export type SyncConfig = z.infer<typeof SyncConfigSchema>;

/**
 * Persist Storage Backend Enum
 */
export const PersistStorageSchema = lazySchema(() => z.enum([
  'indexeddb',
  'localstorage',
  'sqlite',
]).describe('Client-side storage backend for offline cache'));

export type PersistStorage = z.infer<typeof PersistStorageSchema>;

/**
 * Eviction Policy Enum
 */
export const EvictionPolicySchema = lazySchema(() => z.enum([
  'lru',
  'lfu',
  'fifo',
]).describe('Cache eviction policy'));

export type EvictionPolicy = z.infer<typeof EvictionPolicySchema>;

/**
 * Offline Cache Configuration Schema
 * Controls how data is persisted on the client for offline access.
 */
export const OfflineCacheConfigSchema = lazySchema(() => z.object({
  maxSize: z.number().optional().describe('Maximum cache size in bytes'),
  ttl: z.number().optional().describe('Time-to-live for cached entries in milliseconds'),
  persistStorage: PersistStorageSchema.default('indexeddb').describe('Storage backend'),
  evictionPolicy: EvictionPolicySchema.default('lru').describe('Cache eviction policy when full'),
}).describe('Client-side offline cache configuration'));

export type OfflineCacheConfig = z.infer<typeof OfflineCacheConfigSchema>;

/**
 * Offline Configuration Schema
 * Top-level offline support configuration for an application or component.
 */
export const OfflineConfigSchema = lazySchema(() => z.object({
  enabled: z.boolean().default(false).describe('Enable offline support'),
  strategy: OfflineStrategySchema.default('network_first').describe('Default offline fetch strategy'),
  cache: OfflineCacheConfigSchema.optional().describe('Cache settings for offline data'),
  sync: SyncConfigSchema.optional().describe('Sync settings for offline mutations'),
  offlineIndicator: z.boolean().default(true).describe('Show a visual indicator when offline'),
  offlineMessage: I18nLabelSchema.optional().describe('Customizable offline status message shown to users'),
  queueMaxSize: z.number().optional().describe('Maximum number of queued offline mutations'),
}).describe('Offline support configuration'));

export type OfflineConfig = z.infer<typeof OfflineConfigSchema>;
