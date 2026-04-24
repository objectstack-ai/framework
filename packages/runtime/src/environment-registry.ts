// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Contracts } from '@objectstack/spec';
type IDataDriver = Contracts.IDataDriver;

/**
 * Project-scoped driver registry with LRU caching.
 *
 * Resolves projects by hostname or ID, lazily instantiates data drivers,
 * and caches them with TTL to avoid re-querying control plane on every request.
 *
 * Implements ADR-0004 project routing: request → hostname/header/session →
 * sys_project → sys_project_credential → project-scoped IDataDriver.
 *
 * (Historically named "EnvironmentDriverRegistry" for ADR-0002 compatibility;
 * semantics are the same — each project owns its physical database.)
 */
export interface EnvironmentDriverRegistry {
  /**
   * Resolve project by hostname (e.g. "acme-dev.objectstack.app").
   * Returns { projectId, driver } if found, null otherwise.
   * Caches result with TTL.
   */
  resolveByHostname(host: string): Promise<{ projectId: string; driver: IDataDriver } | null>;

  /**
   * Resolve project by ID.
   * Returns driver if found, null otherwise.
   * Caches result with TTL.
   */
  resolveById(projectId: string): Promise<IDataDriver | null>;

  /**
   * Lookup cached project row + driver by ID without fetching from control plane.
   * Returns the full cached row (driver + project metadata) when fresh, else null.
   * Used by DefaultProjectKernelFactory to avoid duplicate control-plane queries.
   */
  peekById(projectId: string): { projectId: string; driver: IDataDriver; project: any } | null;

  /**
   * Invalidate cached driver for given project.
   * Call this when project is updated (e.g. hostname change, credential rotation).
   */
  invalidate(projectId: string): void;
}

interface CacheEntry {
  projectId: string;
  driver: IDataDriver;
  project: any;
  expiresAt: number;
}

/**
 * Secret encryptor interface - must match service-tenant NoopSecretEncryptor
 */
export interface SecretEncryptor {
  readonly keyId: string;
  encrypt(plaintext: string): Promise<string> | string;
  decrypt(ciphertext: string): Promise<string> | string;
}

/**
 * No-op encryptor used in development / tests. **Never** use in production.
 */
export class NoopSecretEncryptor implements SecretEncryptor {
  readonly keyId = 'noop';
  encrypt(plaintext: string): string {
    return plaintext;
  }
  decrypt(ciphertext: string): string {
    return ciphertext;
  }
}

/**
 * Default implementation of EnvironmentDriverRegistry with LRU caching.
 *
 * Queries `sys.project` + `sys.project_credential` on the control-plane driver.
 */
export class DefaultEnvironmentDriverRegistry implements EnvironmentDriverRegistry {
  private readonly controlPlaneDriver: IDataDriver;
  private readonly encryptor: SecretEncryptor;
  private readonly cacheTTL: number;
  private readonly projectObjectName: string;
  private readonly credentialObjectName: string;
  private readonly hostnameCache = new Map<string, CacheEntry>();
  private readonly idCache = new Map<string, CacheEntry>();
  private readonly pendingResolves = new Map<string, Promise<CacheEntry | null>>();

  constructor(config: {
    controlPlaneDriver: IDataDriver;
    encryptor?: SecretEncryptor;
    cacheTTLMs?: number;
    projectObjectName?: string;
    credentialObjectName?: string;
  }) {
    this.controlPlaneDriver = config.controlPlaneDriver;
    this.encryptor = config.encryptor ?? new NoopSecretEncryptor();
    this.cacheTTL = config.cacheTTLMs ?? 5 * 60 * 1000;
    // Default to the namespaced physical names that ObjectQL-registered
    // tenant objects end up with (`sys.project` → `sys_project`). Callers
    // can override — e.g. a mocked driver in unit tests might use the short
    // name directly.
    // Default to the physical table names produced by ObjectQL / the SQL
    // driver for the tenant plugin's `sys.*` namespace. The short name is
    // `sys_project`; drivers store the physical table under that name.
    // Callers can override for test drivers that use different naming.
    this.projectObjectName = config.projectObjectName ?? 'sys_project';
    this.credentialObjectName = config.credentialObjectName ?? 'sys_project_credential';
  }

  async resolveByHostname(host: string): Promise<{ projectId: string; driver: IDataDriver } | null> {
    const cached = this.hostnameCache.get(host);
    if (cached && cached.expiresAt > Date.now()) {
      return { projectId: cached.projectId, driver: cached.driver };
    }

    const cacheKey = `host:${host}`;
    const pending = this.pendingResolves.get(cacheKey);
    if (pending) {
      const result = await pending;
      return result ? { projectId: result.projectId, driver: result.driver } : null;
    }

    const resolvePromise = this.fetchAndCacheByHostname(host);
    this.pendingResolves.set(cacheKey, resolvePromise);

    try {
      const entry = await resolvePromise;
      return entry ? { projectId: entry.projectId, driver: entry.driver } : null;
    } finally {
      this.pendingResolves.delete(cacheKey);
    }
  }

  async resolveById(projectId: string): Promise<IDataDriver | null> {
    const cached = this.idCache.get(projectId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.driver;
    }

    const cacheKey = `id:${projectId}`;
    const pending = this.pendingResolves.get(cacheKey);
    if (pending) {
      const result = await pending;
      return result?.driver ?? null;
    }

    const resolvePromise = this.fetchAndCacheById(projectId);
    this.pendingResolves.set(cacheKey, resolvePromise);

    try {
      const entry = await resolvePromise;
      return entry?.driver ?? null;
    } finally {
      this.pendingResolves.delete(cacheKey);
    }
  }

  peekById(projectId: string): { projectId: string; driver: IDataDriver; project: any } | null {
    const cached = this.idCache.get(projectId);
    if (cached && cached.expiresAt > Date.now()) {
      return { projectId: cached.projectId, driver: cached.driver, project: cached.project };
    }
    return null;
  }

  invalidate(projectId: string): void {
    this.idCache.delete(projectId);
    for (const [hostname, entry] of this.hostnameCache.entries()) {
      if (entry.projectId === projectId) {
        this.hostnameCache.delete(hostname);
      }
    }
  }

  private async fetchAndCacheByHostname(host: string): Promise<CacheEntry | null> {
    try {
      const result = await this.controlPlaneDriver.find(this.projectObjectName, {
        object: this.projectObjectName,
        where: { hostname: host },
        limit: 1,
      } as any);

      const rows = Array.isArray(result) ? result : (result as any)?.value ?? [];
      const projectRow = rows[0];

      if (!projectRow) {
        return null;
      }

      const entry = await this.buildCacheEntry(projectRow);
      if (entry) {
        this.hostnameCache.set(host, entry);
        this.idCache.set(entry.projectId, entry);
      }

      return entry;
    } catch (error) {
      console.error(`[EnvironmentRegistry] Failed to resolve hostname ${host}:`, error);
      return null;
    }
  }

  private async fetchAndCacheById(projectId: string): Promise<CacheEntry | null> {
    try {
      const result = await this.controlPlaneDriver.find(this.projectObjectName, {
        object: this.projectObjectName,
        where: { id: projectId },
        limit: 1,
      } as any);

      const rows = Array.isArray(result) ? result : (result as any)?.value ?? [];
      const projectRow = rows[0];

      if (!projectRow) {
        return null;
      }

      const entry = await this.buildCacheEntry(projectRow);
      if (entry) {
        this.idCache.set(projectId, entry);
        if (projectRow.hostname) {
          this.hostnameCache.set(projectRow.hostname, entry);
        }
      }

      return entry;
    } catch (error) {
      console.error(`[EnvironmentRegistry] Failed to resolve project ID ${projectId}:`, error);
      return null;
    }
  }

  private async buildCacheEntry(projectRow: any): Promise<CacheEntry | null> {
    const projectId = projectRow.id;
    const databaseUrl = projectRow.database_url;
    const databaseDriver = projectRow.database_driver;

    if (!databaseUrl || !databaseDriver) {
      const status = projectRow.status;
      if (status === 'provisioning' || status === 'pending') {
        // Expected during async provisioning — database_url is set after the background job completes
        console.debug(`[EnvironmentRegistry] Project ${projectId} is ${status}, database not ready yet`);
      } else {
        console.warn(`[EnvironmentRegistry] Project ${projectId} missing database_url or database_driver (status: ${status ?? 'unknown'})`);
      }
      return null;
    }

    const credResult = await this.controlPlaneDriver.find(this.credentialObjectName, {
      object: this.credentialObjectName,
      where: { project_id: projectId, status: 'active' },
      limit: 1,
    } as any);

    const credRows = Array.isArray(credResult) ? credResult : (credResult as any)?.value ?? [];
    const credRow = credRows[0];

    const plaintextSecret = credRow
      ? await Promise.resolve(this.encryptor.decrypt(credRow.secret_ciphertext))
      : '';

    const driver = await this.createDriver(databaseDriver, databaseUrl, plaintextSecret);

    return {
      projectId,
      driver,
      project: projectRow,
      expiresAt: Date.now() + this.cacheTTL,
    };
  }

  private async createDriver(driverType: string, databaseUrl: string, authToken: string): Promise<IDataDriver> {
    switch (driverType) {
      case 'memory': {
        const { InMemoryDriver } = await import('@objectstack/driver-memory');
        // Derive a per-project JSON path from the `memory://<dbName>` URL
        // so each project owns its own persistence file instead of every
        // memory-driver project sharing a single `memory-driver.json`.
        // Mirrors DefaultProjectKernelFactory.createDriver so both paths
        // (cache warm-up here + factory fallback) land on the same file.
        const { resolve: resolvePath } = await import('node:path');
        const dbName = databaseUrl.replace(/^memory:\/\//, '').trim();
        const filePath = dbName
          ? resolvePath(process.cwd(), '.objectstack/data/projects', `${dbName}.json`)
          : undefined;
        return new InMemoryDriver({
          persistence: filePath ? { type: 'file', path: filePath } : 'file',
        }) as unknown as IDataDriver;
      }

      case 'sqlite':
      case 'sql': {
        const filePath = databaseUrl.replace(/^file:/, '').replace(/^sql:\/\//, '');
        const { SqlDriver } = await import('@objectstack/driver-sql');
        return new SqlDriver({
          client: 'better-sqlite3',
          connection: {
            filename: filePath,
          },
          useNullAsDefault: true,
        }) as unknown as IDataDriver;
      }

      case 'libsql':
      case 'turso': {
        const { TursoDriver } = await import('@objectstack/driver-turso');
        return new TursoDriver({
          url: databaseUrl,
          authToken,
        }) as unknown as IDataDriver;
      }

      case 'postgres':
      case 'postgresql':
      case 'pg': {
        const { SqlDriver } = await import('@objectstack/driver-sql');
        return new SqlDriver({
          client: 'pg',
          connection: databaseUrl,
          pool: { min: 0, max: 5 },
        }) as unknown as IDataDriver;
      }

      default:
        throw new Error(`[EnvironmentRegistry] Unsupported driver type: ${driverType}`);
    }
  }
}

/**
 * Create a default environment driver registry instance.
 */
export function createEnvironmentDriverRegistry(
  controlPlaneDriver: IDataDriver,
  options?: {
    encryptor?: SecretEncryptor;
    cacheTTLMs?: number;
    projectObjectName?: string;
    credentialObjectName?: string;
  },
): EnvironmentDriverRegistry {
  return new DefaultEnvironmentDriverRegistry({
    controlPlaneDriver,
    encryptor: options?.encryptor,
    cacheTTLMs: options?.cacheTTLMs,
    projectObjectName: options?.projectObjectName,
    credentialObjectName: options?.credentialObjectName,
  });
}
