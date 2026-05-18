// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * EnvironmentDriverRegistry implementation that talks to the control plane
 * over HTTP via {@link ArtifactApiClient}.
 *
 * Mirrors {@link DefaultEnvironmentDriverRegistry} from `environment-registry.ts`
 * but does **not** read from a local control-plane database. Hostname →
 * projectId resolution and per-project runtime config (database URL /
 * driver) come from the control plane API.
 *
 * The cached `project` payload exposed by `peekById()` is shaped to look
 * like a `sys_project` row so callers downstream (notably
 * `ArtifactKernelFactory`) can read `id`, `organization_id`,
 * `database_url` and `database_driver` without branching.
 */

import type * as Contracts from '@objectstack/spec/contracts';
import { resolve as resolvePathNode } from 'node:path';
import type { EnvironmentDriverRegistry } from './environment-registry.js';
import type { ArtifactApiClient, ProjectRuntimeConfig } from './artifact-api-client.js';

type IDataDriver = Contracts.IDataDriver;

interface CacheEntry {
    projectId: string;
    driver: IDataDriver;
    project: any;
    expiresAt: number;
}

export interface ArtifactEnvironmentRegistryConfig {
    client: ArtifactApiClient;
    /** Cache TTL for resolved drivers in ms. Default: 5 min. */
    cacheTtlMs?: number;
    /** Optional logger. */
    logger?: { info?: (...a: any[]) => void; warn?: (...a: any[]) => void; error?: (...a: any[]) => void };
}

export class ArtifactEnvironmentRegistry implements EnvironmentDriverRegistry {
    private readonly client: ArtifactApiClient;
    private readonly cacheTTL: number;
    private readonly logger: NonNullable<ArtifactEnvironmentRegistryConfig['logger']>;

    private readonly hostnameCache = new Map<string, CacheEntry>();
    private readonly idCache = new Map<string, CacheEntry>();
    private readonly pending = new Map<string, Promise<CacheEntry | null>>();

    constructor(config: ArtifactEnvironmentRegistryConfig) {
        this.client = config.client;
        this.cacheTTL = config.cacheTtlMs ?? 5 * 60 * 1000;
        this.logger = config.logger ?? console;
    }

    async resolveByHostname(host: string): Promise<{ projectId: string; driver: IDataDriver } | null> {
        const cached = this.hostnameCache.get(host);
        if (cached && cached.expiresAt > Date.now()) {
            return { projectId: cached.projectId, driver: cached.driver };
        }
        const key = `host:${host}`;
        const inflight = this.pending.get(key);
        if (inflight) {
            const result = await inflight;
            return result ? { projectId: result.projectId, driver: result.driver } : null;
        }
        const promise = (async (): Promise<CacheEntry | null> => {
            try {
                const resolved = await this.client.resolveHostname(host);
                if (!resolved) return null;
                const entry = await this.buildCacheEntry(resolved.projectId, resolved.runtime, resolved.organizationId, host);
                if (!entry) return null;
                this.hostnameCache.set(host, entry);
                this.idCache.set(entry.projectId, entry);
                return entry;
            } catch (err: any) {
                this.logger.error?.('[ArtifactEnvironmentRegistry] resolveByHostname failed', {
                    host,
                    error: err?.message ?? err,
                });
                return null;
            } finally {
                this.pending.delete(key);
            }
        })();
        this.pending.set(key, promise);
        const entry = await promise;
        return entry ? { projectId: entry.projectId, driver: entry.driver } : null;
    }

    async resolveById(projectId: string): Promise<IDataDriver | null> {
        const cached = this.idCache.get(projectId);
        if (cached && cached.expiresAt > Date.now()) return cached.driver;

        const key = `id:${projectId}`;
        const inflight = this.pending.get(key);
        if (inflight) {
            const result = await inflight;
            return result?.driver ?? null;
        }
        const promise = (async (): Promise<CacheEntry | null> => {
            try {
                const entry = await this.buildCacheEntry(projectId, undefined, undefined, undefined);
                if (!entry) return null;
                this.idCache.set(projectId, entry);
                if (entry.project?.hostname) this.hostnameCache.set(entry.project.hostname, entry);
                return entry;
            } catch (err: any) {
                this.logger.error?.('[ArtifactEnvironmentRegistry] resolveById failed', {
                    projectId,
                    error: err?.message ?? err,
                });
                return null;
            } finally {
                this.pending.delete(key);
            }
        })();
        this.pending.set(key, promise);
        const entry = await promise;
        return entry?.driver ?? null;
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
        for (const [host, entry] of this.hostnameCache) {
            if (entry.projectId === projectId) this.hostnameCache.delete(host);
        }
        this.client.invalidate(projectId);
    }

    private async buildCacheEntry(
        projectId: string,
        runtimeFromHostname: ProjectRuntimeConfig | undefined,
        orgIdFromHostname: string | undefined,
        hostname: string | undefined,
    ): Promise<CacheEntry | null> {
        let runtime = runtimeFromHostname;
        let organizationId = orgIdFromHostname;
        let host = hostname;
        let artifactProjectId = projectId;

        if (!runtime || !organizationId) {
            const artifact = await this.client.fetchArtifact(projectId);
            if (!artifact) {
                this.logger.warn?.('[ArtifactEnvironmentRegistry] artifact not found', { projectId });
                return null;
            }
            artifactProjectId = artifact.projectId ?? projectId;
            if (!runtime) runtime = artifact.runtime ?? extractRuntimeFromMetadata(artifact.metadata);
            if (!organizationId) organizationId = artifact.runtime?.organizationId;
            if (!host) host = artifact.runtime?.hostname;
        }

        if (!runtime || !runtime.databaseUrl || !runtime.databaseDriver) {
            this.logger.warn?.('[ArtifactEnvironmentRegistry] no runtime config for project', { projectId });
            return null;
        }

        const driver = await createDriver(runtime.databaseDriver, runtime.databaseUrl, runtime.databaseAuthToken ?? '');

        const projectRow = {
            id: artifactProjectId,
            organization_id: organizationId,
            hostname: host,
            database_url: runtime.databaseUrl,
            database_driver: runtime.databaseDriver,
        };

        return {
            projectId: artifactProjectId,
            driver,
            project: projectRow,
            expiresAt: Date.now() + this.cacheTTL,
        };
    }
}

/**
 * Best-effort fallback: if the control plane did not return an explicit
 * `runtime` block, look for a default datasource in the compiled artifact
 * and reuse its connection config. Useful for self-published artifacts
 * where the developer encoded the connection inline (e.g. memory:// for
 * demos).
 */
function extractRuntimeFromMetadata(metadata: any): ProjectRuntimeConfig | undefined {
    const datasources = metadata?.datasources;
    if (!Array.isArray(datasources) || datasources.length === 0) return undefined;
    const mapping: any[] | undefined = metadata?.datasourceMapping;
    let preferredName: string | undefined;
    if (mapping) {
        const def = mapping.find((m: any) => m?.default === true);
        if (def?.datasource) preferredName = def.datasource;
    }
    const ds = preferredName
        ? datasources.find((d: any) => d?.name === preferredName)
        : datasources[0];
    if (!ds || typeof ds !== 'object') return undefined;
    const config = (ds.config ?? {}) as Record<string, any>;
    const url = config.url ?? config.connectionString ?? config.connection ?? config.filename;
    const driver = ds.driver;
    if (typeof driver !== 'string' || typeof url !== 'string') return undefined;
    return {
        databaseDriver: driver,
        databaseUrl: url,
        databaseAuthToken: typeof config.authToken === 'string' ? config.authToken : undefined,
    };
}

async function createDriver(driverType: string, databaseUrl: string, authToken: string): Promise<IDataDriver> {
    switch (driverType) {
        case 'memory': {
            const { InMemoryDriver } = await import('@objectstack/driver-memory');
            const dbName = databaseUrl.replace(/^memory:\/\//, '').trim();
            // Resolve memory persistence files under the process cwd's
            // `.objectstack/data/projects/<name>.json` — keeps file-only dev
            // self-contained without depending on the cloud package's
            // serverless data-dir resolver.
            const filePath = dbName
                ? resolvePathNode(process.cwd(), '.objectstack/data/projects', `${dbName}.json`)
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
        case 'mongodb':
        case 'mongo': {
            const { MongoDBDriver } = await import('@objectstack/driver-mongodb');
            return new MongoDBDriver({ url: databaseUrl }) as unknown as IDataDriver;
        }
        default:
            throw new Error(`[ArtifactEnvironmentRegistry] Unsupported driver type: ${driverType}`);
    }
}
