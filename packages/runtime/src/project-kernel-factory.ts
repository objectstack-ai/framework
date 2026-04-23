// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectKernel, Plugin } from '@objectstack/core';
import type { Contracts } from '@objectstack/spec';
import { DriverPlugin } from './driver-plugin.js';
import { AppPlugin } from './app-plugin.js';
import type { ProjectKernelFactory } from './kernel-manager.js';
import type { EnvironmentDriverRegistry, SecretEncryptor } from './environment-registry.js';
import { NoopSecretEncryptor } from './environment-registry.js';

type IDataDriver = Contracts.IDataDriver;

/**
 * Row shape fetched from control plane `sys_project`.
 * Only the fields required to stand up a data-plane kernel are enumerated —
 * additional columns are ignored.
 */
export interface SysProjectRow {
  id: string;
  organization_id?: string;
  database_url?: string | null;
  database_driver?: string | null;
  hostname?: string | null;
  metadata?: string | null;
  [k: string]: any;
}

/**
 * Row shape fetched from `sys_project_credential` (`status = 'active'`).
 */
export interface SysProjectCredentialRow {
  id: string;
  project_id: string;
  secret_ciphertext: string;
  encryption_key_id?: string;
  [k: string]: any;
}

/**
 * Resolves the list of App bundles a project is subscribed to. Free-form —
 * implementations typically query `sys_project_package` on the control plane
 * and hydrate bundles from a package registry (or a static manifest map).
 */
export interface AppBundleResolver {
  resolve(project: SysProjectRow): Promise<any[]>;
}

/**
 * Factory that builds, for every project, the **base** set of plugins that
 * sit below the project's apps (e.g. ObjectQL, Metadata, REST, …).
 *
 * Each invocation must return fresh plugin instances — plugins may not be
 * shared across kernels.
 */
export interface BasePluginsFactory {
  (args: { projectId: string; project: SysProjectRow; driver: IDataDriver }): Promise<Plugin[]> | Plugin[];
}

export interface DefaultProjectKernelFactoryConfig {
  /** Control-plane data driver (shared singleton) used to fetch metadata. */
  controlPlaneDriver: IDataDriver;
  /** Returns base plugins (ObjectQL, Metadata, REST, …). Required. */
  basePlugins: BasePluginsFactory;
  /** Optional resolver for project-subscribed App bundles. */
  appBundles?: AppBundleResolver;
  /** Secret decryptor. Defaults to `NoopSecretEncryptor` (dev only). */
  encryptor?: SecretEncryptor;
  /**
   * Optional environment registry. When provided, the factory will
   * reuse the registry's cached project row and driver instance
   * (populated by HttpDispatcher's hostname/id resolution) instead of
   * re-querying the control plane and re-instantiating the driver.
   */
  envRegistry?: EnvironmentDriverRegistry;
  /** Optional logger. Falls back to `console`. */
  logger?: { info?: (...a: any[]) => void; warn?: (...a: any[]) => void; error?: (...a: any[]) => void };
  /** Override kernel config (timeouts, etc.). */
  kernelConfig?: ConstructorParameters<typeof ObjectKernel>[0];
}

/**
 * Default {@link ProjectKernelFactory}.
 *
 * Per `create(projectId)` call it:
 * 1. Reads `sys_project` + active `sys_project_credential` from the control
 *    plane.
 * 2. Decrypts the credential and instantiates a project-scoped
 *    {@link IDataDriver} (memory/sqlite/turso dispatched dynamically).
 * 3. Builds a fresh {@link ObjectKernel}, registers the driver, the
 *    caller-provided base plugins and every resolved App bundle.
 * 4. Returns the bootstrapped kernel.
 */
export class DefaultProjectKernelFactory implements ProjectKernelFactory {
  private readonly controlPlaneDriver: IDataDriver;
  private readonly basePlugins: BasePluginsFactory;
  private readonly appBundles?: AppBundleResolver;
  private readonly encryptor: SecretEncryptor;
  private readonly envRegistry?: EnvironmentDriverRegistry;
  private readonly logger: NonNullable<DefaultProjectKernelFactoryConfig['logger']>;
  private readonly kernelConfig?: DefaultProjectKernelFactoryConfig['kernelConfig'];

  constructor(config: DefaultProjectKernelFactoryConfig) {
    this.controlPlaneDriver = config.controlPlaneDriver;
    this.basePlugins = config.basePlugins;
    this.appBundles = config.appBundles;
    this.encryptor = config.encryptor ?? new NoopSecretEncryptor();
    this.envRegistry = config.envRegistry;
    this.logger = config.logger ?? console;
    this.kernelConfig = config.kernelConfig;
  }

  async create(projectId: string): Promise<ObjectKernel> {
    // Fast path: reuse envRegistry's cached driver + project row when
    // HttpDispatcher has already warmed it via hostname/header resolution.
    let project: SysProjectRow | null = null;
    let driver: IDataDriver | null = null;

    const cached = this.envRegistry?.peekById(projectId);
    if (cached) {
      project = cached.project as SysProjectRow;
      driver = cached.driver;
    }

    if (!project) {
      // Next best: force envRegistry to resolve (populates its own cache);
      // this avoids duplicating the control-plane query in the factory.
      if (this.envRegistry) {
        const resolved = await this.envRegistry.resolveById(projectId);
        if (resolved) {
          const fresh = this.envRegistry.peekById(projectId);
          if (fresh) {
            project = fresh.project as SysProjectRow;
            driver = fresh.driver;
          }
        }
      }
    }

    if (!project) {
      project = await this.fetchProject(projectId);
    }
    if (!project) {
      throw new Error(`[ProjectKernelFactory] Project not found: ${projectId}`);
    }
    if (!project.database_url || !project.database_driver) {
      throw new Error(`[ProjectKernelFactory] Project ${projectId} missing database_url/database_driver`);
    }

    if (!driver) {
      const credential = await this.fetchActiveCredential(projectId);
      const authToken = credential
        ? await Promise.resolve(this.encryptor.decrypt(credential.secret_ciphertext))
        : '';
      driver = await this.createDriver(project.database_driver, project.database_url, authToken);
    }

    const basePlugins = await this.basePlugins({ projectId, project, driver });
    const bundles = this.appBundles ? await this.appBundles.resolve(project) : [];

    const kernel = new ObjectKernel(this.kernelConfig);

    // Driver first — base plugins (ObjectQL, Metadata, …) depend on it.
    await kernel.use(new DriverPlugin(driver));
    for (const p of basePlugins) await kernel.use(p);
    for (const b of bundles) await kernel.use(new AppPlugin(b));

    await kernel.bootstrap();
    this.logger.info?.('[ProjectKernelFactory] kernel ready', {
      projectId,
      driver: project.database_driver,
      bundles: bundles.length,
    });
    return kernel;
  }

  private async fetchProject(projectId: string): Promise<SysProjectRow | null> {
    // Tenant plugin registers the project object under namespace 'sys' so
    // ObjectQL / the underlying driver store it as the physical table
    // `sys_project` (namespace `_` name). Use that physical name here —
    // this path is only used when `envRegistry.peekById` misses, so we go
    // through the raw driver rather than the ObjectQL layer.
    const result = await this.controlPlaneDriver.find('sys_project', {
      object: 'sys_project',
      where: { id: projectId },
      limit: 1,
    } as any);
    const rows = Array.isArray(result) ? result : (result as any)?.value ?? [];
    return rows[0] ?? null;
  }

  private async fetchActiveCredential(projectId: string): Promise<SysProjectCredentialRow | null> {
    const result = await this.controlPlaneDriver.find('sys_project_credential', {
      object: 'sys_project_credential',
      where: { project_id: projectId, status: 'active' },
      limit: 1,
    } as any);
    const rows = Array.isArray(result) ? result : (result as any)?.value ?? [];
    return rows[0] ?? null;
  }

  private async createDriver(
    driverType: string,
    databaseUrl: string,
    authToken: string,
  ): Promise<IDataDriver> {
    switch (driverType) {
      case 'memory': {
        const { InMemoryDriver } = await import('@objectstack/driver-memory');
        // Derive a per-project JSON file path from the `memory://<dbName>`
        // URL so each project gets its own `.objectstack/data/projects/<dbName>.json`
        // snapshot instead of every memory-driver project clobbering a single
        // shared `memory-driver.json`. Falls back to the adapter's default
        // path if the URL does not carry a usable name.
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
        // `sql` is the short name of the generic SqlDriver; in self-hosted
        // / multi-project modes projects are often created with driver='sql'
        // (SqlDriver registered under `com.objectstack.driver.sql`) and a
        // `file:` URL pointing at a SQLite file. Treat it identically to
        // an explicit 'sqlite' request.
        const filePath = databaseUrl.replace(/^file:/, '').replace(/^sql:\/\//, '');
        const { SqlDriver } = await import('@objectstack/driver-sql');
        return new SqlDriver({
          client: 'better-sqlite3',
          connection: { filename: filePath },
          useNullAsDefault: true,
        }) as unknown as IDataDriver;
      }
      case 'libsql':
      case 'turso': {
        const { TursoDriver } = await import('@objectstack/driver-turso');
        return new TursoDriver({ url: databaseUrl, authToken }) as unknown as IDataDriver;
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
        throw new Error(`[ProjectKernelFactory] Unsupported driver type: ${driverType}`);
    }
  }
}
