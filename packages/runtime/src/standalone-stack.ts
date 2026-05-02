// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Standalone (runtime-only) stack factory.
 *
 * Builds the minimal plugin list for embedding ObjectStack in another
 * framework: ObjectQL + Driver + Metadata, plus AppPlugin if a compiled
 * artifact is available. No authentication, no Studio data, no control
 * plane — REST routes are served unauthenticated.
 *
 * Auto-detects the appropriate driver from the database URL:
 *   - `memory://*`              → InMemoryDriver
 *   - `libsql://`, `https://`   → TursoDriver
 *   - `file:` / anything else   → SqlDriver (better-sqlite3)
 */

import { resolve as resolvePath } from 'node:path';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

export const StandaloneStackConfigSchema = z.object({
    databaseUrl: z.string().optional(),
    databaseAuthToken: z.string().optional(),
    databaseDriver: z.enum(['sqlite', 'turso', 'memory', 'postgres']).optional(),
    projectId: z.string().optional(),
    artifactPath: z.string().optional(),
});

export type StandaloneStackConfig = z.input<typeof StandaloneStackConfigSchema>;

export interface StandaloneStackResult {
    plugins: any[];
    api: { enableProjectScoping: false; projectResolution: 'none' };
}

export async function createStandaloneStack(config?: StandaloneStackConfig): Promise<StandaloneStackResult> {
    const cfg = StandaloneStackConfigSchema.parse(config ?? {});

    const { ObjectQLPlugin } = await import('@objectstack/objectql');
    const { MetadataPlugin } = await import('@objectstack/metadata');
    const { DriverPlugin } = await import('./driver-plugin.js');
    const { AppPlugin } = await import('./app-plugin.js');

    const cwd = process.cwd();
    const projectId = cfg.projectId ?? process.env.OS_PROJECT_ID ?? 'proj_local';
    const artifactPath = cfg.artifactPath
        ?? process.env.OS_ARTIFACT_PATH
        ?? resolvePath(cwd, 'dist/objectstack.json');

    const dbUrl = cfg.databaseUrl
        ?? process.env.OS_DATABASE_URL?.trim()
        ?? process.env.TURSO_DATABASE_URL?.trim()
        ?? `file:${resolvePath(cwd, '.objectstack/data/standalone.db')}`;
    const dbAuthToken = cfg.databaseAuthToken
        ?? process.env.OS_DATABASE_AUTH_TOKEN?.trim()
        ?? process.env.TURSO_AUTH_TOKEN?.trim();
    const dbDriver = cfg.databaseDriver
        ?? process.env.OS_DATABASE_DRIVER?.trim()
        ?? (/^(libsql|https?):\/\//i.test(dbUrl) ? 'turso' : 'sqlite');

    let driverPlugin: any;
    if (dbDriver === 'memory' || dbUrl.startsWith('memory://')) {
        const { InMemoryDriver } = await import('@objectstack/driver-memory');
        driverPlugin = new DriverPlugin(new InMemoryDriver());
    } else if (dbDriver === 'turso' || /^(libsql|https?):\/\//i.test(dbUrl)) {
        const { TursoDriver } = await import('@objectstack/driver-turso');
        driverPlugin = new DriverPlugin(
            new TursoDriver({ url: dbUrl, authToken: dbAuthToken }) as any,
        );
    } else {
        const { SqlDriver } = await import('@objectstack/driver-sql');
        const filename = dbUrl.replace(/^file:(\/\/)?/, '');
        mkdirSync(resolvePath(filename, '..'), { recursive: true });
        driverPlugin = new DriverPlugin(
            new SqlDriver({
                client: 'better-sqlite3',
                connection: { filename },
                useNullAsDefault: true,
            }),
        );
    }

    let artifactBundle: any = null;
    try {
        const raw = await readFile(artifactPath, 'utf8');
        const parsed = JSON.parse(raw);
        artifactBundle = (parsed?.schemaVersion != null && parsed?.metadata !== undefined)
            ? parsed.metadata
            : parsed;
        console.warn(
            `[StandaloneStack] artifact loaded: path=${artifactPath} keys=${artifactBundle ? Object.keys(artifactBundle).join(',') : '(null)'} flows=${Array.isArray(artifactBundle?.flows) ? artifactBundle.flows.length : 'n/a'}`,
        );
    } catch (err: any) {
        console.warn(`[StandaloneStack] artifact load FAILED: path=${artifactPath} error=${err?.message}`);
    }

    const plugins: any[] = [
        driverPlugin,
        new MetadataPlugin({
            watch: false,
            projectId,
            artifactSource: { mode: 'local-file', path: artifactPath },
        }),
        new ObjectQLPlugin({ projectId }),
    ];
    if (artifactBundle) plugins.push(new AppPlugin(artifactBundle));

    return {
        plugins,
        api: {
            enableProjectScoping: false,
            projectResolution: 'none',
        },
    };
}
