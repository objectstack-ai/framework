// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectKernel, Plugin } from '@objectstack/core';
import type * as Contracts from '@objectstack/spec/contracts';
import { DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ControlPlaneProxyDriver } from './control-plane-proxy-driver.js';
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
 * Resolves the list of App bundles a project is subscribed to.
 */
export interface AppBundleResolver {
  resolve(project: SysProjectRow): Promise<any[]>;
}

/**
 * Factory that builds, for every project, the **base** set of plugins that
 * sit below the project's apps.
 *
 * Each invocation must return fresh plugin instances — plugins may not be
 * shared across kernels.
 */
export interface BasePluginsFactory {
  (args: { projectId: string; project: SysProjectRow; driver: IDataDriver }): Promise<Plugin[]> | Plugin[];
}

/**
 * Static project config for local / offline mode.
 */
export interface LocalProjectConfig {
  projectId: string;
  organizationId?: string;
  databaseUrl: string;
  databaseDriver: string;
}

export interface DefaultProjectKernelFactoryConfig {
  controlPlaneDriver?: IDataDriver;
  basePlugins: BasePluginsFactory;
  appBundles?: AppBundleResolver;
  encryptor?: SecretEncryptor;
  envRegistry?: EnvironmentDriverRegistry;
  logger?: { info?: (...a: any[]) => void; warn?: (...a: any[]) => void; error?: (...a: any[]) => void };
  kernelConfig?: ConstructorParameters<typeof ObjectKernel>[0];
  localProject?: LocalProjectConfig;
}

export class DefaultProjectKernelFactory implements ProjectKernelFactory {
  private readonly controlPlaneDriver?: IDataDriver;
  private readonly basePlugins: BasePluginsFactory;
  private readonly appBundles?: AppBundleResolver;
  private readonly encryptor: SecretEncryptor;
  private readonly envRegistry?: EnvironmentDriverRegistry;
  private readonly logger: NonNullable<DefaultProjectKernelFactoryConfig['logger']>;
  private readonly kernelConfig?: DefaultProjectKernelFactoryConfig['kernelConfig'];
  private readonly localProject?: LocalProjectConfig;

  constructor(config: DefaultProjectKernelFactoryConfig) {
    this.controlPlaneDriver = config.controlPlaneDriver;
    this.basePlugins = config.basePlugins;
    this.appBundles = config.appBundles;
    this.encryptor = config.encryptor ?? new NoopSecretEncryptor();
    this.envRegistry = config.envRegistry;
    this.logger = config.logger ?? console;
    this.kernelConfig = config.kernelConfig;
    this.localProject = config.localProject;
  }

  async create(projectId: string): Promise<ObjectKernel> {
    if (this.localProject && this.localProject.projectId === projectId) {
      return this._createLocalKernel(this.localProject);
    }

    if (!this.controlPlaneDriver) {
      throw new Error(`[ProjectKernelFactory] No controlPlaneDriver configured and no matching localProject for '${projectId}'`);
    }

    let project: SysProjectRow | null = null;
    let driver: IDataDriver | null = null;

    const cached = this.envRegistry?.peekById(projectId);
    if (cached) {
      project = cached.project as SysProjectRow;
      driver = cached.driver;
    }

    if (!project) {
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

    await kernel.use(new DriverPlugin(driver));

    const orgId = project.organization_id;
    if (!orgId) {
      throw new Error(`[ProjectKernelFactory] project '${projectId}' is missing organization_id — cannot mount cloud datasource`);
    }
    const proxyDriver = new ControlPlaneProxyDriver(this.controlPlaneDriver!, orgId);
    await kernel.use(new DriverPlugin(proxyDriver, { registerAsDefault: false, datasourceName: 'cloud' } as any));

    for (const p of basePlugins) await kernel.use(p);
    const projectName = (project as any).name ?? (project as any).hostname;
    for (const b of bundles) {
      const sys = b?.manifest || b;
      const packageId = sys?.packageId ?? sys?.package_id ?? b?.packageId;
      await kernel.use(new AppPlugin(b, {
        projectId,
        organizationId: orgId,
        projectName,
        packageId,
        source: packageId ? 'package' : 'user',
      } as any));
    }

    await kernel.bootstrap();

    try {
      const currentNames = new Set(
        bundles
          .map((b: any) => {
            const sys = b?.manifest || b;
            return sys?.name ?? sys?.id;
          })
          .filter((n: any): n is string => typeof n === 'string' && n.length > 0),
      );
      const existing = await proxyDriver.find('sys_app', {
        where: { project_id: projectId },
        limit: 10_000,
      } as any);
      const rows: Array<{ name?: string }> = Array.isArray(existing)
        ? existing
        : (existing as any)?.value ?? [];
      const stale = rows.filter((r) => r?.name && !currentNames.has(r.name));
      const deleteMany = (proxyDriver as any).deleteMany;
      if (stale.length && typeof deleteMany === 'function') {
        for (const row of stale) {
          await deleteMany.call(proxyDriver, 'sys_app', {
            where: { project_id: projectId, name: row.name },
          });
        }
        this.logger.info?.('[ProjectKernelFactory] sys_app catalog reconciled', {
          projectId,
          removed: stale.length,
        });
      }
    } catch (err: any) {
      this.logger.warn?.('[ProjectKernelFactory] sys_app reconciliation skipped', {
        projectId,
        error: err?.message,
      });
    }

    this.logger.info?.('[ProjectKernelFactory] kernel ready', {
      projectId,
      driver: project.database_driver,
      bundles: bundles.length,
    });
    return kernel;
  }

  private async _createLocalKernel(cfg: LocalProjectConfig): Promise<ObjectKernel> {
    const { projectId, organizationId, databaseUrl, databaseDriver } = cfg;

    const syntheticProject: SysProjectRow = {
      id: projectId,
      organization_id: organizationId,
      database_url: databaseUrl,
      database_driver: databaseDriver,
    };

    const driver = await this.createDriver(databaseDriver, databaseUrl, '');
    const basePlugins = await this.basePlugins({ projectId, project: syntheticProject, driver });
    const bundles = this.appBundles ? await this.appBundles.resolve(syntheticProject) : [];

    const kernel = new ObjectKernel(this.kernelConfig);
    await kernel.use(new DriverPlugin(driver));
    for (const p of basePlugins) await kernel.use(p);

    const projectName = syntheticProject.hostname ?? projectId;
    for (const b of bundles) {
      const sys = b?.manifest || b;
      const packageId = sys?.packageId ?? sys?.package_id ?? b?.packageId;
      await kernel.use(new AppPlugin(b, {
        projectId,
        organizationId: organizationId ?? '',
        projectName,
        packageId,
        source: packageId ? 'package' : 'user',
      } as any));
    }

    await kernel.bootstrap();

    this.logger.info?.('[ProjectKernelFactory] local kernel ready', {
      projectId,
      driver: databaseDriver,
      bundles: bundles.length,
    });
    return kernel;
  }

  private async fetchProject(projectId: string): Promise<SysProjectRow | null> {
    if (!this.controlPlaneDriver) {
      throw new Error(`[ProjectKernelFactory] controlPlaneDriver is required in cloud mode`);
    }
    const result = await this.controlPlaneDriver.find('sys_project', {
      object: 'sys_project',
      where: { id: projectId },
      limit: 1,
    } as any);
    const rows = Array.isArray(result) ? result : (result as any)?.value ?? [];
    return rows[0] ?? null;
  }

  private async fetchActiveCredential(projectId: string): Promise<SysProjectCredentialRow | null> {
    if (!this.controlPlaneDriver) {
      throw new Error(`[ProjectKernelFactory] controlPlaneDriver is required in cloud mode`);
    }
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
