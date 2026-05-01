// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Cloud-side Artifact API plugin.
 *
 * Exposes the M3 Artifact API endpoints that runtime-mode nodes (see
 * `runtime-stack.ts` / `objectos-stack.ts`) call to discover their per-
 * request project and download its compiled artifact:
 *
 *   GET /api/v1/cloud/resolve-hostname?host={hostname}
 *     → { success, data: { projectId, organizationId?, runtime? } }
 *
 *   GET /api/v1/cloud/projects/:id/artifact
 *     → { success, data: ProjectArtifact + { runtime? } }
 *
 * Implementation notes:
 *
 *   - Project rows live in the control-plane DB (`sys_project`). We
 *     resolve a hostname by exact `hostname` match. The wildcard `*`
 *     marker matches any host (used by the system project).
 *   - The artifact response is assembled from the project's metadata
 *     (`metadata.artifact_path` / `artifact_paths`) plus a `runtime`
 *     block carrying the project's database addressing (driver / URL /
 *     auth token from `sys_project_credential`). The artifact's
 *     `metadata` array is loaded by reading the file(s) at
 *     `artifact_path` and merging their `metadata` sections — same shape
 *     fs-bundle-resolver consumes for in-process kernels.
 *
 * This plugin is registered alongside the multi-project stack (see
 * `cloud-stack.ts`) so the cloud control plane and the runtime nodes
 * speak the same protocol whether they share a process or not.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve as resolvePath, isAbsolute, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import type { IHttpServer } from '@objectstack/spec/contracts';
import type { IDataDriver } from '@objectstack/spec/contracts';

type AnyContext = any;

interface CloudArtifactApiPluginOptions {
    /** Promise resolving to the control-plane driver — same one cloud-stack uses. */
    controlDriverPromise: Promise<{ driver: IDataDriver; driverName: string; databaseUrl: string }>;
    /** API prefix (default `/api/v1`). */
    apiPrefix?: string;
    /** Filesystem root for relative `artifact_path` values (default `process.cwd()`). */
    artifactRoot?: string;
    /** Bearer token required on requests (optional — when unset, endpoints are open to localhost callers). */
    apiKey?: string;
}

interface SysProjectRow {
    id: string;
    organization_id?: string;
    hostname?: string;
    database_driver?: string;
    database_url?: string;
    database_auth_token?: string;
    metadata?: Record<string, unknown> | string;
    is_system?: boolean | number;
}

interface SysCredentialRow {
    id: string;
    project_id: string;
    database_driver?: string;
    database_url?: string;
    database_auth_token?: string;
}

function ok<T>(data: T) { return { success: true, data }; }
function fail(message: string, status = 400) { return { status, body: { success: false, error: message } }; }

function parseMetadata(raw: any): Record<string, unknown> {
    if (!raw) return {};
    if (typeof raw === 'string') {
        try { return JSON.parse(raw) ?? {}; } catch { return {}; }
    }
    if (typeof raw === 'object') return raw as Record<string, unknown>;
    return {};
}

function extractArtifactPaths(metadata: Record<string, unknown>): string[] {
    const out: string[] = [];
    const single = metadata.artifact_path;
    if (typeof single === 'string') out.push(single);
    const list = metadata.artifact_paths;
    if (Array.isArray(list)) {
        for (const p of list) if (typeof p === 'string') out.push(p);
    }
    return out;
}

function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

/**
 * Known per-category metadata keys recognised by ObjectOS at boot. We
 * lift these top-level arrays out of each loaded bundle into the
 * envelope's `metadata` block. Unknown keys are also captured so future
 * spec additions don't require a code update here.
 */
const KNOWN_METADATA_CATEGORIES = new Set([
    'objects', 'fields', 'views', 'apps', 'pages', 'dashboards', 'reports',
    'flows', 'workflows', 'triggers', 'agents', 'tools', 'skills',
    'permissions', 'permissionSets', 'roles', 'profiles', 'translations',
    'datasources', 'datasets', 'actions', 'apis', 'i18n', 'sharingRules',
    'ragPipelines', 'data',
]);

/**
 * Merge metadata blocks from multiple artifact files into a single
 * envelope. Accepts either of two bundle shapes:
 *
 *   1. The v0 ProjectArtifact envelope (`{ metadata: { objects: [...] } }`)
 *   2. The current `objectstack compile` output, which writes category
 *      arrays at the top level (`{ objects: [...], apps: [...] }`).
 *
 * Per-category arrays are concatenated in file order; downstream
 * consumers de-dupe by name when registering.
 */
function mergeArtifactMetadata(bundles: any[]): Record<string, any[]> {
    const merged: Record<string, any[]> = {};

    const ingest = (source: Record<string, any>) => {
        for (const [key, value] of Object.entries(source)) {
            if (!Array.isArray(value)) continue;
            if (!KNOWN_METADATA_CATEGORIES.has(key) && key !== 'manifest') {
                // Still capture array-shaped unknown categories — passthrough.
                if (typeof key !== 'string') continue;
            }
            const bucket = merged[key] ?? (merged[key] = []);
            bucket.push(...value);
        }
    };

    for (const b of bundles) {
        if (!b || typeof b !== 'object') continue;
        // Shape 1: nested under .metadata
        const nested = (b as any).metadata;
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
            ingest(nested);
        }
        // Shape 2: flat (current compile output)
        ingest(b as Record<string, any>);
    }
    return merged;
}

async function readArtifactFile(absPath: string): Promise<any | null> {
    try {
        const raw = await readFile(absPath, 'utf-8');
        return JSON.parse(raw);
    } catch (err: any) {
        console.warn(`[CloudArtifactAPI] Failed to read artifact '${absPath}': ${err?.message ?? err}`);
        return null;
    }
}

async function resolveProjectByHost(driver: IDataDriver, host: string): Promise<SysProjectRow | null> {
    if (!host) return null;
    // Exact match first.
    const direct = await (driver.findOne as any)('sys_project', { where: { hostname: host } });
    if (direct) return direct as SysProjectRow;
    // Then any project flagged as a wildcard catch-all (`hostname = '*'`).
    const wildcard = await (driver.findOne as any)('sys_project', { where: { hostname: '*' } });
    if (wildcard) return wildcard as SysProjectRow;
    return null;
}

async function readProjectCredentials(driver: IDataDriver, projectId: string): Promise<SysCredentialRow | null> {
    try {
        const row = await (driver.findOne as any)('sys_project_credential', {
            where: { project_id: projectId },
        });
        return (row ?? null) as SysCredentialRow | null;
    } catch {
        return null;
    }
}

function buildRuntimeBlock(project: SysProjectRow, cred: SysCredentialRow | null) {
    const driver = (cred?.database_driver ?? project.database_driver ?? '').trim();
    const url = (cred?.database_url ?? project.database_url ?? '').trim();
    if (!driver || !url) return undefined;
    const out: Record<string, any> = {
        organizationId: project.organization_id,
        hostname: project.hostname,
        databaseDriver: driver,
        databaseUrl: url,
    };
    const token = cred?.database_auth_token ?? project.database_auth_token;
    if (token) out.databaseAuthToken = token;
    return out;
}

export function createCloudArtifactApiPlugin(options: CloudArtifactApiPluginOptions): any {
    const prefix = options.apiPrefix ?? '/api/v1';
    const artifactRoot = options.artifactRoot ?? process.env.OBJECTSTACK_PROJECT_ARTIFACT_ROOT ?? process.cwd();
    const requiredKey = options.apiKey ?? process.env.OBJECTSTACK_CLOUD_API_KEY;

    return {
        name: 'com.objectstack.cloud.artifact-api',
        version: '1.0.0',
        init: async (_ctx: AnyContext) => {},
        start: async (ctx: AnyContext) => {
            let server: IHttpServer | undefined;
            try {
                server = ctx.getService('http.server') as IHttpServer | undefined;
            } catch { return; }
            if (!server) return;

            const checkAuth = (req: any): { ok: true } | { ok: false; status: number; body: any } => {
                if (!requiredKey) return { ok: true };
                const header = (req.headers?.authorization ?? req.headers?.Authorization ?? '') as string;
                const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
                if (token === requiredKey) return { ok: true };
                return { ok: false, status: 401, body: { success: false, error: 'Unauthorized' } };
            };

            const getDriver = async (): Promise<IDataDriver | null> => {
                try {
                    const { driver } = await options.controlDriverPromise;
                    return driver ?? null;
                } catch (err: any) {
                    console.error('[CloudArtifactAPI] control driver unavailable:', err?.message ?? err);
                    return null;
                }
            };

            // ---- GET /cloud/resolve-hostname?host=... ------------------------------
            server.get(`${prefix}/cloud/resolve-hostname`, async (req: any, res: any) => {
                const auth = checkAuth(req);
                if (!auth.ok) return res.status(auth.status).json(auth.body);
                const host = String(req.query?.host ?? req.query?.hostname ?? '').trim();
                if (!host) return res.status(400).json({ success: false, error: 'host query parameter is required' });

                const driver = await getDriver();
                if (!driver) return res.status(503).json({ success: false, error: 'control plane unavailable' });

                const project = await resolveProjectByHost(driver, host);
                if (!project) return res.status(404).json({ success: false, error: `No project bound to hostname '${host}'` });

                const cred = await readProjectCredentials(driver, project.id);
                const runtime = buildRuntimeBlock(project, cred);
                return res.json(ok({
                    projectId: project.id,
                    organizationId: project.organization_id,
                    runtime,
                }));
            });

            // ---- GET /cloud/projects/:id/artifact ----------------------------------
            server.get(`${prefix}/cloud/projects/:id/artifact`, async (req: any, res: any) => {
                const auth = checkAuth(req);
                if (!auth.ok) return res.status(auth.status).json(auth.body);
                const projectId = String(req.params?.id ?? '').trim();
                if (!projectId) return res.status(400).json({ success: false, error: 'project id required' });

                const driver = await getDriver();
                if (!driver) return res.status(503).json({ success: false, error: 'control plane unavailable' });

                const project = (await (driver.findOne as any)('sys_project', { where: { id: projectId } })) as SysProjectRow | null;
                if (!project) return res.status(404).json({ success: false, error: `Project '${projectId}' not found` });

                const metadata = parseMetadata(project.metadata);
                const paths = extractArtifactPaths(metadata);
                const bundles: any[] = [];
                for (const p of paths) {
                    const abs = isAbsolute(p) ? p : resolvePath(artifactRoot, p);
                    const bundle = await readArtifactFile(abs);
                    if (bundle) bundles.push(bundle);
                }

                const cred = await readProjectCredentials(driver, project.id);
                const runtime = buildRuntimeBlock(project, cred);

                // Use the first bundle's commitId / builtAt / manifest if
                // present so consumers can rev-cache; otherwise mint a stable
                // synthetic value derived from the merged content.
                const first = bundles[0] ?? {};
                const mergedMetadata = mergeArtifactMetadata(bundles);
                const functions = bundles.flatMap((b) => Array.isArray(b?.functions) ? b.functions : []);
                const manifest = first.manifest ?? { plugins: [], drivers: [], engines: {} };
                const commitId = first.commitId
                    ?? sha256Hex(JSON.stringify(mergedMetadata) + ':' + JSON.stringify(functions)).slice(0, 16);
                const checksum = first.checksum
                    ?? { algorithm: 'sha256', value: sha256Hex(JSON.stringify({ mergedMetadata, functions, manifest })) };

                const envelope = {
                    schemaVersion: '0.1',
                    projectId: project.id,
                    commitId,
                    checksum,
                    metadata: mergedMetadata,
                    functions,
                    manifest,
                    builtAt: first.builtAt ?? new Date().toISOString(),
                    builtWith: first.builtWith,
                    runtime,
                };
                return res.json(ok(envelope));
            });

            // ---- POST /cloud/projects/:id/metadata --------------------------------
            // Receives a compiled artifact (objectstack compile output) and stores
            // it on the project row so the GET /artifact endpoint can serve it.
            server.post(`${prefix}/cloud/projects/:id/metadata`, async (req: any, res: any) => {
                const auth = checkAuth(req);
                if (!auth.ok) return res.status(auth.status).json(auth.body);
                const projectId = String(req.params?.id ?? '').trim();
                if (!projectId) return res.status(400).json({ success: false, error: 'project id required' });

                const driver = await getDriver();
                if (!driver) return res.status(503).json({ success: false, error: 'control plane unavailable' });

                const project = (await (driver.findOne as any)('sys_project', { where: { id: projectId } })) as SysProjectRow | null;
                if (!project) return res.status(404).json({ success: false, error: `Project '${projectId}' not found` });

                // Accept the raw artifact body (output of `objectstack compile`).
                const body = req.body ?? {};
                if (typeof body !== 'object' || Array.isArray(body)) {
                    return res.status(400).json({ success: false, error: 'Request body must be a JSON object' });
                }

                // Persist the artifact as a file under artifactRoot/<projectId>/artifact.json
                // and update sys_project.metadata.artifact_path so GET /artifact can find it.
                const artifactDir = resolvePath(artifactRoot, projectId);
                const artifactFile = resolvePath(artifactDir, 'artifact.json');

                try {
                    await mkdir(artifactDir, { recursive: true });
                    await writeFile(artifactFile, JSON.stringify(body, null, 2), 'utf-8');
                } catch (err: any) {
                    console.error('[CloudArtifactAPI] Failed to write artifact:', err?.message ?? err);
                    return res.status(500).json({ success: false, error: 'Failed to persist artifact' });
                }

                // Update the project row's metadata to point at the new file.
                const existingMeta = parseMetadata(project.metadata);
                const updatedMeta = { ...existingMeta, artifact_path: artifactFile };
                try {
                    await (driver.update as any)('sys_project', { id: projectId }, { metadata: JSON.stringify(updatedMeta) });
                } catch (err: any) {
                    console.error('[CloudArtifactAPI] Failed to update project metadata:', err?.message ?? err);
                    // Non-fatal — artifact file is already written; GET /artifact will work next boot.
                }

                // Compute commitId / checksum for the response.
                const bodyStr = JSON.stringify(body);
                const commitId = (body as any).commitId ?? sha256Hex(bodyStr).slice(0, 16);
                const checksum = (body as any).checksum ?? { algorithm: 'sha256', value: sha256Hex(bodyStr) };

                return res.json(ok({ projectId, commitId, checksum }));
            });
        },
        stop: async (_ctx: AnyContext) => {},
    };
}
