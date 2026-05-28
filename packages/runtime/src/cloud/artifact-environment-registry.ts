// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * EnvironmentDriverRegistry implementation that talks to the control plane
 * over HTTP via {@link ArtifactApiClient}.
 *
 * Mirrors {@link DefaultEnvironmentDriverRegistry} from `environment-registry.ts`
 * but does **not** read from a local control-plane database. Hostname →
 * environmentId resolution and per-project runtime config (database URL /
 * driver) come from the control plane API.
 *
 * The cached `project` payload exposed by `peekById()` is shaped to look
 * like a `sys_environment` row so callers downstream (notably
 * `ArtifactKernelFactory`) can read `id`, `organization_id`,
 * `database_url` and `database_driver` without branching.
 */

import type * as Contracts from '@objectstack/spec/contracts';
import { resolve as resolvePathNode } from 'node:path';
import type { EnvironmentDriverRegistry } from './environment-registry.js';
import type { ArtifactApiClient, EnvironmentRuntimeConfig } from './artifact-api-client.js';

type IDataDriver = Contracts.IDataDriver;

interface CacheEntry {
    environmentId: string;
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

    async resolveByHostname(host: string): Promise<{ environmentId: string; driver: IDataDriver } | null> {
        const cached = this.hostnameCache.get(host);
        if (cached && cached.expiresAt > Date.now()) {
            return { environmentId: cached.environmentId, driver: cached.driver };
        }
        const key = `host:${host}`;
        const inflight = this.pending.get(key);
        if (inflight) {
            const result = await inflight;
            return result ? { environmentId: result.environmentId, driver: result.driver } : null;
        }
        const promise = (async (): Promise<CacheEntry | null> => {
            try {
                const resolved = await this.client.resolveHostname(host);
                if (!resolved) return null;
                const entry = await this.buildCacheEntry(resolved.environmentId, resolved.runtime, resolved.organizationId, host);
                if (!entry) return null;
                this.hostnameCache.set(host, entry);
                this.idCache.set(entry.environmentId, entry);
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
        return entry ? { environmentId: entry.environmentId, driver: entry.driver } : null;
    }

    async resolveById(environmentId: string): Promise<IDataDriver | null> {
        const cached = this.idCache.get(environmentId);
        if (cached && cached.expiresAt > Date.now()) return cached.driver;

        const key = `id:${environmentId}`;
        const inflight = this.pending.get(key);
        if (inflight) {
            const result = await inflight;
            return result?.driver ?? null;
        }
        const promise = (async (): Promise<CacheEntry | null> => {
            try {
                const entry = await this.buildCacheEntry(environmentId, undefined, undefined, undefined);
                if (!entry) return null;
                this.idCache.set(environmentId, entry);
                if (entry.project?.hostname) this.hostnameCache.set(entry.project.hostname, entry);
                return entry;
            } catch (err: any) {
                this.logger.error?.('[ArtifactEnvironmentRegistry] resolveById failed', {
                    environmentId,
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

    peekById(environmentId: string): { environmentId: string; driver: IDataDriver; project: any } | null {
        const cached = this.idCache.get(environmentId);
        if (cached && cached.expiresAt > Date.now()) {
            return { environmentId: cached.environmentId, driver: cached.driver, project: cached.project };
        }
        return null;
    }

    invalidate(environmentId: string): void {
        this.idCache.delete(environmentId);
        for (const [host, entry] of this.hostnameCache) {
            if (entry.environmentId === environmentId) this.hostnameCache.delete(host);
        }
        this.client.invalidate(environmentId);
    }

    private async buildCacheEntry(
        environmentId: string,
        runtimeFromHostname: EnvironmentRuntimeConfig | undefined,
        orgIdFromHostname: string | undefined,
        hostname: string | undefined,
    ): Promise<CacheEntry | null> {
        let runtime = runtimeFromHostname;
        let organizationId = orgIdFromHostname;
        let host = hostname;
        let artifactProjectId = environmentId;

        if (!runtime || !organizationId) {
            const artifact = await this.client.fetchArtifact(environmentId);
            if (!artifact) {
                this.logger.warn?.('[ArtifactEnvironmentRegistry] artifact not found', { environmentId });
                return null;
            }
            artifactProjectId = artifact.environmentId ?? environmentId;
            if (!runtime) runtime = artifact.runtime ?? extractRuntimeFromMetadata(artifact.metadata);
            if (!organizationId) organizationId = artifact.runtime?.organizationId;
            if (!host) host = artifact.runtime?.hostname;
        }

        if (!runtime || !runtime.databaseUrl || !runtime.databaseDriver) {
            this.logger.warn?.('[ArtifactEnvironmentRegistry] no runtime config for project', { environmentId });
            return null;
        }

        const driver = await createDriver(runtime.databaseDriver, runtime.databaseUrl, runtime.databaseAuthToken ?? '');

        const projectRow = {
            id: artifactProjectId,
            organization_id: organizationId,
            hostname: host,
            database_url: runtime.databaseUrl,
            database_driver: runtime.databaseDriver,
            metadata: runtime.metadata,
        };

        return {
            environmentId: artifactProjectId,
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
function extractRuntimeFromMetadata(metadata: any): EnvironmentRuntimeConfig | undefined {
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
        case 'libsql':
        case 'turso': {
            // The libsql/turso driver was extracted out of the framework
            // monorepo into `cloud/packages/driver-turso` (May 2026).
            // Package name is unchanged, so `await import(...)` resolves
            // it from the host app's node_modules (apps/objectos pins
            // `@objectstack/driver-turso: workspace:*` from the cloud
            // workspace, which surfaces in the Docker image's
            // node_modules layout). Self-host installs that need Turso
            // must `npm install @objectstack/driver-turso` from the cloud
            // package (or use the published version) before booting.
            let TursoDriver: any;
            try {
                ({ TursoDriver } = await import('@objectstack/driver-turso' as any));
            } catch (err: any) {
                throw new Error(
                    `[ArtifactEnvironmentRegistry] libsql/turso driver requested but @objectstack/driver-turso is not installed. ` +
                    `Install it from the cloud monorepo (cloud/packages/driver-turso) or via npm. (${err?.message ?? err})`,
                );
            }
            return new TursoDriver({ url: databaseUrl, authToken }) as unknown as IDataDriver;
        }
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
