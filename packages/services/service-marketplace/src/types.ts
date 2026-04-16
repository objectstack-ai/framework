// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Remote plugin manifest from cloud marketplace
 */
export interface RemotePluginManifest {
  /** Plugin unique identifier (e.g., 'com.example.crm') */
  id: string;

  /** Human-readable name */
  name: string;

  /** Semantic version */
  version: string;

  /** Plugin namespace */
  namespace: string;

  /** Plugin type */
  type: 'app' | 'plugin';

  /** ESM module URL */
  moduleUrl: string;

  /** Subresource Integrity hash (optional) */
  integrity?: string;

  /** Plugin dependencies (plugin IDs) */
  dependencies?: string[];

  /** Whether to auto-load on startup */
  autoload?: boolean;

  /** Plugin description */
  description?: string;

  /** Plugin author */
  author?: string;

  /** Plugin icon URL */
  icon?: string;

  /** Plugin tags */
  tags?: string[];
}

/**
 * Marketplace service configuration
 */
export interface MarketplaceConfig {
  /** Cloud marketplace base URL */
  marketplaceUrl: string;

  /** Authentication token for private plugins */
  authToken?: string;

  /** Enable in-memory caching */
  enableCache: boolean;

  /** Cache TTL in seconds */
  cacheTTL: number;

  /** Persist plugin state in database */
  persistState: boolean;

  /** Timeout for HTTP requests (ms) */
  requestTimeout?: number;
}

/**
 * Plugin installation result
 */
export interface PluginInstallResult {
  success: boolean;
  pluginId: string;
  error?: string;
}

/**
 * Plugin uninstall result
 */
export interface PluginUninstallResult {
  success: boolean;
  pluginId: string;
  error?: string;
}

/**
 * Installed plugin info
 */
export interface InstalledPluginInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  autoload: boolean;
  installedAt: string;
  updatedAt: string;
}
