// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Multi-Tenant Router for TursoDriver
 *
 * Manages per-tenant TursoDriver instances with TTL-based caching.
 * Uses a URL template with `{tenant}` placeholder that is replaced
 * with the tenantId at runtime.
 *
 * Serverless-safe: no global intervals, no leaked state. Expired
 * entries are evicted lazily on next access.
 */

import { TursoDriver, type TursoDriverConfig } from './turso-driver.js';

// ── Configuration ────────────────────────────────────────────────────────────

/**
 * Configuration for the multi-tenant router.
 *
 * @example
 * ```typescript
 * const router = createMultiTenantRouter({
 *   urlTemplate: 'file:./data/{tenant}.db',
 *   clientCacheTTL: 300_000, // 5 minutes
 * });
 *
 * const driver = await router.getDriverForTenant('acme');
 * ```
 */
export interface MultiTenantConfig {
  /**
   * URL template with `{tenant}` placeholder.
   * Example: `'file:./data/{tenant}.db'` or `'libsql://{tenant}-org.turso.io'`
   */
  urlTemplate: string;

  /**
   * Shared auth token for the Turso group (used for all tenant databases).
   * Individual tenant tokens can be provided via `driverConfigOverrides`.
   */
  groupAuthToken?: string;

  /**
   * Cache TTL in milliseconds. Cached drivers are evicted after this period.
   * Default: 300_000 (5 minutes).
   */
  clientCacheTTL?: number;

  /**
   * Optional callback invoked when a new tenant driver is created.
   * Useful for provisioning tenant databases via the Turso Platform API.
   */
  onTenantCreate?: (tenantId: string) => Promise<void>;

  /**
   * Optional callback invoked before a tenant driver is removed from cache.
   */
  onTenantEvict?: (tenantId: string) => Promise<void>;

  /**
   * Additional TursoDriverConfig fields merged into every tenant driver config.
   * `url` is overridden by the template.
   */
  driverConfigOverrides?: Omit<Partial<TursoDriverConfig>, 'url'>;
}

// ── Router Interface ─────────────────────────────────────────────────────────

/**
 * Return type of `createMultiTenantRouter`.
 */
export interface MultiTenantRouter {
  /** Get (or create) a connected TursoDriver for the given tenant. */
  getDriverForTenant(tenantId: string): Promise<TursoDriver>;

  /** Immediately invalidate and disconnect a cached tenant driver. */
  invalidateCache(tenantId: string): void;

  /** Disconnect and destroy all cached tenant drivers. Call on process shutdown. */
  destroyAll(): Promise<void>;

  /** Returns the number of currently cached tenant drivers. */
  getCacheSize(): number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CACHE_TTL = 300_000; // 5 minutes
const TENANT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}[a-zA-Z0-9]$/;

// ── Cache Entry ──────────────────────────────────────────────────────────────

interface CacheEntry {
  driver: TursoDriver;
  expiresAt: number;
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a multi-tenant router that manages per-tenant TursoDriver instances.
 *
 * - `urlTemplate` must contain `{tenant}` which is replaced with the tenantId.
 * - Drivers are lazily created and cached in a process-level Map.
 * - Expired entries are evicted on next access (lazy expiration).
 * - Serverless-safe: no global intervals, no leaked state.
 *
 * @example
 * ```typescript
 * const router = createMultiTenantRouter({
 *   urlTemplate: 'file:./data/{tenant}.db',
 * });
 *
 * const driver = await router.getDriverForTenant('acme');
 * const users = await driver.find('users', {});
 * ```
 */
export function createMultiTenantRouter(config: MultiTenantConfig): MultiTenantRouter {
  if (!config.urlTemplate) {
    throw new Error('MultiTenantConfig requires a "urlTemplate".');
  }
  if (!config.urlTemplate.includes('{tenant}')) {
    throw new Error('urlTemplate must contain a "{tenant}" placeholder.');
  }

  const ttl = config.clientCacheTTL ?? DEFAULT_CACHE_TTL;
  const cache = new Map<string, CacheEntry>();

  function validateTenantId(tenantId: string): void {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('tenantId must be a non-empty string.');
    }
    if (!TENANT_ID_PATTERN.test(tenantId)) {
      throw new Error(
        `Invalid tenantId "${tenantId}". Must be 2-64 alphanumeric characters, hyphens, or underscores.`,
      );
    }
  }

  function buildUrl(tenantId: string): string {
    return config.urlTemplate.replace(/\{tenant\}/g, tenantId);
  }

  async function evictEntry(tenantId: string, entry: CacheEntry): Promise<void> {
    cache.delete(tenantId);
    try {
      await entry.driver.disconnect();
    } catch {
      // Disconnect failure is non-fatal during eviction
    }
    if (config.onTenantEvict) {
      try {
        await config.onTenantEvict(tenantId);
      } catch {
        // Callback failure is non-fatal
      }
    }
  }

  async function getDriverForTenant(tenantId: string): Promise<TursoDriver> {
    validateTenantId(tenantId);

    const existing = cache.get(tenantId);
    if (existing) {
      if (Date.now() < existing.expiresAt) {
        return existing.driver;
      }
      // Expired — evict and recreate
      await evictEntry(tenantId, existing);
    }

    // Create new driver
    const url = buildUrl(tenantId);
    const driverConfig: TursoDriverConfig = {
      ...config.driverConfigOverrides,
      url,
      authToken: config.groupAuthToken ?? config.driverConfigOverrides?.authToken,
    };

    const driver = new TursoDriver(driverConfig);

    if (config.onTenantCreate) {
      await config.onTenantCreate(tenantId);
    }

    await driver.connect();

    cache.set(tenantId, {
      driver,
      expiresAt: Date.now() + ttl,
    });

    return driver;
  }

  function invalidateCache(tenantId: string): void {
    const entry = cache.get(tenantId);
    if (entry) {
      cache.delete(tenantId);
      // Fire-and-forget disconnect
      entry.driver.disconnect().catch(() => {});
      if (config.onTenantEvict) {
        config.onTenantEvict(tenantId).catch(() => {});
      }
    }
  }

  async function destroyAll(): Promise<void> {
    const entries = Array.from(cache.entries());
    cache.clear();

    await Promise.allSettled(
      entries.map(async ([tenantId, entry]) => {
        try {
          await entry.driver.disconnect();
        } catch {
          // Non-fatal
        }
        if (config.onTenantEvict) {
          try {
            await config.onTenantEvict(tenantId);
          } catch {
            // Non-fatal
          }
        }
      }),
    );
  }

  function getCacheSize(): number {
    return cache.size;
  }

  return {
    getDriverForTenant,
    invalidateCache,
    destroyAll,
    getCacheSize,
  };
}
