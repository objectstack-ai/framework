// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * File-backed ArtifactApiClient.
 *
 * A drop-in replacement for {@link ArtifactApiClient} that reads a
 * single project's compiled artifact from a local JSON file instead of
 * an HTTP control plane. Intended for:
 *
 *   - `pnpm dev` workflows where standing up a full `apps/cloud`
 *     instance to host one artifact is overkill.
 *   - Smoke tests / CI that need a hermetic objectos boot.
 *   - Single-tenant self-hosted deployments that ship one artifact
 *     baked into the container image.
 *
 * Hostname resolution is the identity function: every host resolves
 * to the same `environmentId`. The runtime config (database URL +
 * driver) is synthesised from the artifact's default datasource,
 * matching what the cloud API would mint for a project whose
 * developer declared an inline datasource in `defineStack()`.
 *
 * Public API mirrors {@link ArtifactApiClient} so callers can swap
 * implementations transparently.
 */

import { readFile, stat } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import type {
    EnvironmentArtifactResponse,
    EnvironmentRuntimeConfig,
    ResolvedHostname,
} from './artifact-api-client.js';

export interface FileArtifactApiClientConfig {
    /**
     * Path to a compiled artifact JSON file (`dist/objectstack.json`).
     * Resolved against `process.cwd()` when relative. Defaults to
     * `<cwd>/dist/objectstack.json`.
     */
    artifactPath?: string;
    /**
     * Project id every hostname maps to. Defaults to
     * `process.env.OS_ENVIRONMENT_ID` or `'proj_local'`.
     */
    environmentId?: string;
    /**
     * Organization id surfaced alongside the project. Defaults to
     * `process.env.OS_ORGANIZATION_ID` or `'org_local'`.
     */
    organizationId?: string;
    /**
     * Override runtime config. When unset, the client tries to derive
     * one from the artifact's `datasources` array; if that fails it
     * falls back to a local-file SQLite DB at
     * `<cwd>/.objectstack/data/<environmentId>.db`.
     */
    runtime?: EnvironmentRuntimeConfig;
    /**
     * Reload the artifact on every fetch instead of caching the first
     * read. Useful when iterating on a project's metadata without
     * restarting objectos. Defaults to `true` for dev ergonomics.
     */
    watch?: boolean;
    /** Optional logger. */
    logger?: { info?: (...a: any[]) => void; warn?: (...a: any[]) => void; error?: (...a: any[]) => void };
}

export class FileArtifactApiClient {
    private readonly artifactPath: string;
    private readonly environmentId: string;
    private readonly organizationId: string;
    private readonly overrideRuntime?: EnvironmentRuntimeConfig;
    private readonly watch: boolean;
    private readonly logger: NonNullable<FileArtifactApiClientConfig['logger']>;

    private cached?: { mtimeMs: number; response: EnvironmentArtifactResponse };

    constructor(config: FileArtifactApiClientConfig = {}) {
        const cwd = process.cwd();
        this.artifactPath = resolvePath(
            cwd,
            config.artifactPath
                ?? process.env.OS_ARTIFACT_PATH
                ?? 'dist/objectstack.json',
        );
        this.environmentId = config.environmentId
            ?? process.env.OS_ENVIRONMENT_ID
            ?? 'proj_local';
        this.organizationId = config.organizationId
            ?? process.env.OS_ORGANIZATION_ID
            ?? 'org_local';
        this.overrideRuntime = config.runtime;
        this.watch = config.watch ?? true;
        this.logger = config.logger ?? console;
    }

    async resolveHostname(_host: string): Promise<ResolvedHostname | null> {
        // Single-project mode: every host maps to the one configured project.
        const runtime = this.overrideRuntime ?? (await this.readRuntimeFromArtifact());
        return {
            environmentId: this.environmentId,
            organizationId: this.organizationId,
            ...(runtime ? { runtime } : {}),
        };
    }

    async fetchArtifact(_environmentId: string, _opts?: { commit?: string }): Promise<EnvironmentArtifactResponse | null> {
        return this.loadArtifact();
    }

    async lookupProjectByShortId(_shortId: string): Promise<{ environmentId: string; organizationId?: string } | null> {
        return { environmentId: this.environmentId, organizationId: this.organizationId };
    }

    async fetchBranchHead(
        _environmentId: string,
        _branchName: string,
    ): Promise<{ commitId: string; publishedAt?: string | null } | null> {
        const artifact = await this.loadArtifact();
        return artifact
            ? { commitId: artifact.commitId ?? 'local', publishedAt: null }
            : null;
    }

    invalidate(_environmentId: string): void {
        this.cached = undefined;
    }

    clear(): void {
        this.cached = undefined;
    }

    private async loadArtifact(): Promise<EnvironmentArtifactResponse | null> {
        try {
            const stats = await stat(this.artifactPath);
            const mtimeMs = stats.mtimeMs;
            if (!this.watch && this.cached) return this.cached.response;
            if (this.cached && this.cached.mtimeMs === mtimeMs) return this.cached.response;

            const raw = await readFile(this.artifactPath, 'utf8');
            const parsed = JSON.parse(raw);
            // The compiled JSON may already be a `EnvironmentArtifact` envelope
            // (with a `metadata` block) or a bare bundle. Wrap when needed.
            const isEnvelope = parsed && typeof parsed === 'object'
                && typeof parsed.metadata === 'object'
                && parsed.metadata !== null;
            const metadata = isEnvelope ? parsed.metadata : parsed;
            const runtime = this.overrideRuntime
                ?? (isEnvelope ? parsed.runtime : undefined)
                ?? this.deriveRuntimeFromMetadata(metadata)
                ?? this.defaultLocalSqliteRuntime();
            const response: EnvironmentArtifactResponse = {
                schemaVersion: parsed.schemaVersion ?? '1',
                environmentId: parsed.environmentId ?? this.environmentId,
                commitId: parsed.commitId ?? 'local',
                checksum: parsed.checksum ?? '',
                publishedAt: parsed.publishedAt ?? new Date().toISOString(),
                metadata,
                functions: parsed.functions,
                manifest: parsed.manifest,
                runtime: {
                    organizationId: this.organizationId,
                    ...runtime,
                },
            } as EnvironmentArtifactResponse;
            this.cached = { mtimeMs, response };
            return response;
        } catch (err: any) {
            this.logger.error?.('[FileArtifactApiClient] failed to load artifact', {
                artifactPath: this.artifactPath,
                error: err?.message ?? err,
            });
            return null;
        }
    }

    private async readRuntimeFromArtifact(): Promise<EnvironmentRuntimeConfig | undefined> {
        const artifact = await this.loadArtifact();
        return artifact?.runtime;
    }

    private deriveRuntimeFromMetadata(metadata: any): EnvironmentRuntimeConfig | undefined {
        const datasources = metadata?.datasources;
        if (!Array.isArray(datasources) || datasources.length === 0) return undefined;
        const mapping: any[] | undefined = metadata?.datasourceMapping;
        let preferredName: string | undefined;
        if (mapping) {
            const def = mapping.find((m: any) => m?.default === true);
            if (def?.datasource) preferredName = def.datasource;
        }
        const ds = preferredName
            ? datasources.find((d: any) => d?.name === preferredName) ?? datasources[0]
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

    private defaultLocalSqliteRuntime(): EnvironmentRuntimeConfig {
        const cwd = process.cwd();
        const dbPath = resolvePath(cwd, '.objectstack/data', `${this.environmentId}.db`);
        return {
            databaseDriver: 'sqlite',
            databaseUrl: `file:${dbPath}`,
        };
    }
}
