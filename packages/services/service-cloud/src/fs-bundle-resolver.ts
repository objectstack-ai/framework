// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * File-System AppBundleResolver.
 *
 * Resolves the artifact bundles a project is bound to by reading the
 * project's row from the control plane (`sys_project.metadata`) and
 * loading any artifact files referenced there.
 *
 * Binding model — a project's `metadata` column may carry:
 *
 *     {
 *         "artifact_path": "./examples/app-crm/dist/objectstack.json",
 *         "artifact_paths": [
 *             "./pkg-a/dist/objectstack.json",
 *             "https://example.com/pkg-b/objectstack.json"
 *         ]
 *     }
 *
 * Local relative paths are resolved against `OS_PROJECT_ARTIFACT_ROOT`
 * (defaults to `process.cwd()`); absolute paths are honored as-is;
 * `http(s)://` URLs are fetched verbatim and never path-joined.
 *
 * For pure dev convenience, an env-var override is also supported:
 *
 *     OS_PROJECT_ARTIFACTS=proj_crm:/abs/path/crm.json,proj_todo:/abs/path/todo.json
 *
 * Entries listed there override `metadata.artifact_path` for that
 * project id, so a developer can rebind without rewriting the DB row.
 *
 * On read errors (missing file, malformed JSON) the resolver logs a
 * warning and returns `[]` for that path.
 */

import { resolve as resolvePath, isAbsolute } from 'node:path';
import { loadArtifactBundle, isHttpUrl } from '@objectstack/runtime';
import type { AppBundleResolver } from './project-kernel-factory.js';

const ENV_MAP_VAR = 'OS_PROJECT_ARTIFACTS';
const ARTIFACT_ROOT_VAR = 'OS_PROJECT_ARTIFACT_ROOT';

function parseEnvMap(raw: string | undefined): Map<string, string[]> {
    const map = new Map<string, string[]>();
    if (!raw) return map;
    for (const segment of raw.split(',')) {
        const trimmed = segment.trim();
        if (!trimmed) continue;
        const idx = trimmed.indexOf(':');
        if (idx <= 0) continue;
        const projectId = trimmed.slice(0, idx).trim();
        const path = trimmed.slice(idx + 1).trim();
        if (!projectId || !path) continue;
        const list = map.get(projectId) ?? [];
        list.push(path);
        map.set(projectId, list);
    }
    return map;
}

function extractMetadataPaths(metadata: any): string[] {
    if (!metadata || typeof metadata !== 'object') return [];
    const out: string[] = [];
    if (typeof metadata.artifact_path === 'string') out.push(metadata.artifact_path);
    if (Array.isArray(metadata.artifact_paths)) {
        for (const p of metadata.artifact_paths) {
            if (typeof p === 'string') out.push(p);
        }
    }
    return out;
}

export function createFsAppBundleResolver(): AppBundleResolver {
    const envMap = parseEnvMap(process.env[ENV_MAP_VAR]);
    const root = process.env[ARTIFACT_ROOT_VAR] ?? process.cwd();
    const cache = new Map<string, any>();

    async function loadOne(path: string): Promise<any | null> {
        const key = isHttpUrl(path)
            ? path
            : (isAbsolute(path) ? path : resolvePath(root, path));
        if (cache.has(key)) return cache.get(key);
        const bundle = await loadArtifactBundle(key, { tag: '[FsAppBundleResolver]' });
        cache.set(key, bundle);
        return bundle;
    }

    return {
        async resolve(project: any) {
            const projectId = project?.id;
            const overridePaths = projectId ? envMap.get(projectId) : undefined;
            let meta: any = project?.metadata;
            if (typeof meta === 'string') {
                try { meta = JSON.parse(meta); } catch { meta = undefined; }
            }
            const metadataPaths = extractMetadataPaths(meta);

            const paths = overridePaths && overridePaths.length > 0
                ? overridePaths
                : metadataPaths;
            if (paths.length === 0) return [];

            const bundles: any[] = [];
            for (const p of paths) {
                const b = await loadOne(p);
                if (b) bundles.push(b);
            }
            return bundles;
        },
    };
}
