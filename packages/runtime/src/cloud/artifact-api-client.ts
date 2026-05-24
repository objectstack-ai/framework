// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Artifact API client.
 *
 * HTTP client that talks to the ObjectStack control plane (e.g.
 * `apps/cloud`) to resolve hostnames to projects and to download a
 * project's compiled artifact.
 *
 * The control plane is expected to expose two endpoints:
 *
 *   GET {controlPlaneUrl}/api/v1/cloud/resolve-hostname?host={hostname}
 *     → { environmentId: string, organizationId?: string, runtime?: EnvironmentRuntimeConfig }
 *
 *   GET {controlPlaneUrl}/api/v1/cloud/environments/:environmentId/artifact
 *     → EnvironmentArtifactResponse  (EnvironmentArtifact + optional `runtime` block)
 *
 * Both endpoints accept an optional `Authorization: Bearer <apiKey>`.
 *
 * Responses are cached in-memory with a TTL so each kernel-manager
 * miss does not produce an extra HTTP round trip. Concurrent callers
 * for the same key share a single in-flight promise (singleflight).
 */

import type { EnvironmentArtifact } from '@objectstack/spec/cloud';

/**
 * Per-project runtime config injected by the control plane alongside
 * the artifact. Carries the physical database URL the runtime should
 * connect to (this is *not* part of the developer-authored compiled
 * artifact — the control plane mints it when serving the API).
 */
export interface EnvironmentRuntimeConfig {
    organizationId?: string;
    hostname?: string;
    /** Driver type — e.g. `sqlite`, `postgres`, `turso`, `memory`. */
    databaseDriver: string;
    /** Driver-specific connection URL. */
    databaseUrl: string;
    /** Optional auth token (e.g. for libSQL/Turso). */
    databaseAuthToken?: string;
    /**
     * Project-level metadata captured by the control plane at create time
     * (e.g. `ownerSeed`, `orgSeed`). Forwarded to the runtime so cold-boot
     * seed replay can mirror the cloud org + owner into the project DB
     * before the user's first SSO callback arrives.
     */
    metadata?: Record<string, unknown>;
}

/**
 * Hostname resolution response.
 */
export interface ResolvedHostname {
    environmentId: string;
    organizationId?: string;
    /** Optional runtime config — when present, callers can skip the artifact fetch's runtime block. */
    runtime?: EnvironmentRuntimeConfig;
}

/**
 * Artifact response wrapping the spec's `EnvironmentArtifact` envelope plus
 * an optional `runtime` block carrying the project's database
 * connection details.
 */
export interface EnvironmentArtifactResponse extends EnvironmentArtifact {
    runtime?: EnvironmentRuntimeConfig;
}

export interface ArtifactApiClientConfig {
    /** Control-plane base URL (no trailing slash). */
    controlPlaneUrl: string;
    /** Optional bearer token. */
    apiKey?: string;
    /** Cache TTL in ms. Default: 5 min. */
    cacheTtlMs?: number;
    /** Timeout for control-plane HTTP calls in ms. Default: 10s. */
    requestTimeoutMs?: number;
    /** Optional fetch override (testing). */
    fetch?: typeof fetch;
    /** Optional logger. */
    logger?: { info?: (...a: any[]) => void; warn?: (...a: any[]) => void; error?: (...a: any[]) => void };
}

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

export class ArtifactApiClient {
    private readonly base: string;
    private readonly apiKey?: string;
    private readonly cacheTtlMs: number;
    private readonly requestTimeoutMs: number;
    private readonly fetchImpl: typeof fetch;
    private readonly logger: NonNullable<ArtifactApiClientConfig['logger']>;

    private readonly hostnameCache = new Map<string, CacheEntry<ResolvedHostname>>();
    private readonly artifactCache = new Map<string, CacheEntry<EnvironmentArtifactResponse>>();
    private readonly pendingHostname = new Map<string, Promise<ResolvedHostname | null>>();
    private readonly pendingArtifact = new Map<string, Promise<EnvironmentArtifactResponse | null>>();

    constructor(config: ArtifactApiClientConfig) {
        if (!config.controlPlaneUrl) {
            throw new Error('[ArtifactApiClient] controlPlaneUrl is required');
        }
        this.base = config.controlPlaneUrl.replace(/\/+$/, '');
        this.apiKey = config.apiKey;
        this.cacheTtlMs = config.cacheTtlMs ?? 5 * 60 * 1000;
        this.requestTimeoutMs = config.requestTimeoutMs ?? 10_000;
        this.fetchImpl = config.fetch ?? globalThis.fetch;
        this.logger = config.logger ?? console;
        if (typeof this.fetchImpl !== 'function') {
            throw new Error('[ArtifactApiClient] global fetch is not available — provide config.fetch');
        }
    }

    /**
     * Resolve a hostname to its project. Returns `null` on 404 or
     * malformed responses. Errors (network / 5xx) are thrown so
     * upstream callers can retry.
     */
    async resolveHostname(host: string): Promise<ResolvedHostname | null> {
        const cached = this.hostnameCache.get(host);
        if (cached && cached.expiresAt > Date.now()) return cached.value;

        const inflight = this.pendingHostname.get(host);
        if (inflight) return inflight;

        const promise = (async () => {
            try {
                const url = `${this.base}/api/v1/cloud/resolve-hostname?host=${encodeURIComponent(host)}`;
                const res = await this.request(url);
                if (res === null) return null;
                const body = res.success === false ? null : (res.data ?? res);
                if (!body || typeof body.environmentId !== 'string' || !body.environmentId) return null;
                const value: ResolvedHostname = {
                    environmentId: body.environmentId,
                    organizationId: body.organizationId,
                    runtime: body.runtime,
                };
                this.hostnameCache.set(host, { value, expiresAt: Date.now() + this.cacheTtlMs });
                return value;
            } finally {
                this.pendingHostname.delete(host);
            }
        })();
        this.pendingHostname.set(host, promise);
        return promise;
    }

    /**
     * Fetch the compiled artifact for a project.
     *
     * When `opts.commit` is set, requests that specific revision via the
     * existing `?commit=` query param. Different commits are cached
     * independently (the cache key includes the commit id) so the preview
     * runtime can hold multiple versions in memory simultaneously.
     */
    async fetchArtifact(environmentId: string, opts?: { commit?: string }): Promise<EnvironmentArtifactResponse | null> {
        const commit = opts?.commit?.trim() || '';
        const cacheKey = commit ? `${environmentId}@${commit}` : environmentId;
        const cached = this.artifactCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) return cached.value;

        const inflight = this.pendingArtifact.get(cacheKey);
        if (inflight) return inflight;

        const promise = (async () => {
            try {
                const qs = commit ? `?commit=${encodeURIComponent(commit)}` : '';
                const url = `${this.base}/api/v1/cloud/environments/${encodeURIComponent(environmentId)}/artifact${qs}`;
                const res = await this.request(url);
                if (res === null) return null;
                const body = res.success === false ? null : (res.data ?? res);
                if (!body || typeof body !== 'object') return null;
                if (!body.metadata) {
                    this.logger.warn?.('[ArtifactApiClient] artifact response missing `metadata`', { environmentId, commit });
                    return null;
                }
                const value = body as EnvironmentArtifactResponse;
                this.artifactCache.set(cacheKey, { value, expiresAt: Date.now() + this.cacheTtlMs });
                return value;
            } finally {
                this.pendingArtifact.delete(cacheKey);
            }
        })();
        this.pendingArtifact.set(cacheKey, promise);
        return promise;
    }

    /**
     * Resolve an 8-hex project short id (first 8 hex chars of the UUID,
     * dashes stripped) to the full environmentId. Used by the preview
     * runtime, which encodes project ids in subdomains.
     *
     * Returns `null` on 404 or ambiguity (the control plane returns 409
     * if the prefix matches more than one project).
     */
    async lookupProjectByShortId(shortId: string): Promise<{ environmentId: string; organizationId?: string } | null> {
        const short = String(shortId ?? '').trim().toLowerCase();
        if (!/^[0-9a-f]{8,}$/.test(short)) return null;
        const url = `${this.base}/api/v1/cloud/environments-by-short-id/${encodeURIComponent(short)}`;
        const res = await this.request(url);
        if (res === null) return null;
        const body = res.success === false ? null : (res.data ?? res);
        if (!body || typeof body.environmentId !== 'string' || !body.environmentId) return null;
        return { environmentId: body.environmentId, organizationId: body.organizationId };
    }

    /**
     * Fetch the head commit of a branch. Returns the commit id (and the
     * matching revision row's `published_at` for cache-validity checks).
     * Reuses the existing `GET /cloud/environments/:id/branches` endpoint.
     */
    async fetchBranchHead(
        environmentId: string,
        branchName: string,
    ): Promise<{ commitId: string; publishedAt?: string | null } | null> {
        const url = `${this.base}/api/v1/cloud/environments/${encodeURIComponent(environmentId)}/branches`;
        const res = await this.request(url);
        if (res === null) return null;
        const body = res.success === false ? null : (res.data ?? res);
        const branches = Array.isArray(body?.branches) ? body.branches : [];
        const target = String(branchName ?? '').trim().toLowerCase();
        const found = branches.find((b: any) => String(b?.branch ?? '').toLowerCase() === target);
        if (!found?.headCommitId) return null;
        return { commitId: String(found.headCommitId), publishedAt: found.headPublishedAt ?? null };
    }

    /** Drop cached entries for a project (and any matching hostname). */
    invalidate(environmentId: string): void {
        // Cache keys are `${environmentId}` for HEAD or `${environmentId}@${commit}`
        // for pinned reads (preview runtime). Drop both shapes.
        this.artifactCache.delete(environmentId);
        const prefix = `${environmentId}@`;
        for (const key of Array.from(this.artifactCache.keys())) {
            if (key.startsWith(prefix)) this.artifactCache.delete(key);
        }
        for (const [host, entry] of this.hostnameCache) {
            if (entry.value.environmentId === environmentId) this.hostnameCache.delete(host);
        }
    }

    /** Drop everything. Used on shutdown / hot-reload. */
    clear(): void {
        this.hostnameCache.clear();
        this.artifactCache.clear();
    }

    private async request(url: string): Promise<any> {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), this.requestTimeoutMs) : null;
        try {
            const res = await this.fetchImpl(url, {
                method: 'GET',
                headers: this.buildHeaders(),
                signal: controller?.signal,
            });
            if (res.status === 404) return null;
            if (!res.ok) {
                throw new Error(`[ArtifactApiClient] ${url} → HTTP ${res.status}`);
            }
            return await res.json();
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    private buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'accept': 'application/json',
            'user-agent': 'objectos-runtime',
        };
        if (this.apiKey) headers['authorization'] = `Bearer ${this.apiKey}`;
        return headers;
    }
}
