// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Standalone (runtime-only) stack factory.
 *
 * Builds the minimal plugin list for embedding ObjectStack in another
 * framework: ObjectQL + Driver + Metadata, plus AppPlugin if a compiled
 * artifact is available. No authentication, no Studio data, no control
 * plane — REST routes are served unauthenticated.
 *
 * Auto-detects the appropriate driver from the database URL scheme:
 *   - `memory://*`              → InMemoryDriver
 *   - `libsql://`, `https://`   → TursoDriver
 *   - `postgres[ql]://`, `pg://` → SqlDriver (pg)
 *   - `mongodb[+srv]://`        → MongoDBDriver (peer-dep `@objectstack/driver-mongodb`)
 *   - `file:` / no scheme       → SqlDriver (better-sqlite3)
 *
 * Unknown URL schemes throw — we never silently fall back to sqlite, since
 * that historically created bogus directories on disk (e.g. `mongodb:/`)
 * when an unsupported URL was treated as a file path.
 */

import { resolve as resolvePath } from 'node:path';
import { mkdirSync } from 'node:fs';
import { z } from 'zod';
import { loadArtifactBundle, isHttpUrl } from './load-artifact-bundle.js';

export const StandaloneStackConfigSchema = z.object({
    databaseUrl: z.string().optional(),
    databaseAuthToken: z.string().optional(),
    databaseDriver: z.enum(['sqlite', 'turso', 'memory', 'postgres', 'mongodb']).optional(),
    projectId: z.string().optional(),
    artifactPath: z.string().optional(),
});

export type StandaloneStackConfig = z.input<typeof StandaloneStackConfigSchema>;

export interface StandaloneStackResult {
    plugins: any[];
    api: { enableProjectScoping: false; projectResolution: 'none' };
}

type ResolvedDriverKind = 'memory' | 'turso' | 'postgres' | 'mongodb' | 'sqlite';

function detectDriverFromUrl(dbUrl: string): ResolvedDriverKind {
    if (/^memory:\/\//i.test(dbUrl)) return 'memory';
    if (/^(libsql|https?):\/\//i.test(dbUrl)) return 'turso';
    if (/^(postgres(ql)?|pg):\/\//i.test(dbUrl)) return 'postgres';
    if (/^mongodb(\+srv)?:\/\//i.test(dbUrl)) return 'mongodb';
    if (/^file:/i.test(dbUrl)) return 'sqlite';
    // Bare path without a scheme — treat as a sqlite file path.
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(dbUrl)) return 'sqlite';
    throw new Error(
        `[StandaloneStack] Unsupported database URL scheme: ${dbUrl}. ` +
        `Supported schemes: memory://, libsql://, https://, postgres://, pg://, mongodb://, mongodb+srv://, file:`
    );
}

export async function createStandaloneStack(config?: StandaloneStackConfig): Promise<StandaloneStackResult> {
    const cfg = StandaloneStackConfigSchema.parse(config ?? {});

    const { ObjectQLPlugin } = await import('@objectstack/objectql');
    const { MetadataPlugin } = await import('@objectstack/metadata');
    const { DriverPlugin } = await import('./driver-plugin.js');
    const { AppPlugin } = await import('./app-plugin.js');

    const cwd = process.cwd();
    const projectId = cfg.projectId ?? process.env.OS_PROJECT_ID ?? 'proj_local';
    const artifactPathInput = cfg.artifactPath
        ?? process.env.OS_ARTIFACT_PATH
        ?? resolvePath(cwd, 'dist/objectstack.json');
    const artifactPath = isHttpUrl(artifactPathInput)
        ? artifactPathInput
        : (artifactPathInput.startsWith('/')
            ? artifactPathInput
            : resolvePath(cwd, artifactPathInput));

    const dbUrl = cfg.databaseUrl
        ?? process.env.OS_DATABASE_URL?.trim()
        ?? process.env.TURSO_DATABASE_URL?.trim()
        ?? `file:${resolvePath(cwd, '.objectstack/data/standalone.db')}`;
    const dbAuthToken = cfg.databaseAuthToken
        ?? process.env.OS_DATABASE_AUTH_TOKEN?.trim()
        ?? process.env.TURSO_AUTH_TOKEN?.trim();
    const explicitDriver = cfg.databaseDriver
        ?? (process.env.OS_DATABASE_DRIVER?.trim() as ResolvedDriverKind | undefined);
    const dbDriver: ResolvedDriverKind = explicitDriver ?? detectDriverFromUrl(dbUrl);

    let driverPlugin: any;
    if (dbDriver === 'memory') {
        const { InMemoryDriver } = await import('@objectstack/driver-memory');
        driverPlugin = new DriverPlugin(new InMemoryDriver());
    } else if (dbDriver === 'turso') {
        const { TursoDriver } = await import('@objectstack/driver-turso');
        driverPlugin = new DriverPlugin(
            new TursoDriver({ url: dbUrl, authToken: dbAuthToken }) as any,
        );
    } else if (dbDriver === 'postgres') {
        const { SqlDriver } = await import('@objectstack/driver-sql');
        driverPlugin = new DriverPlugin(
            new SqlDriver({
                client: 'pg',
                connection: dbUrl,
                pool: { min: 0, max: 5 },
            }) as any,
        );
    } else if (dbDriver === 'mongodb') {
        // MongoDB driver is an optional peer dependency. Importing it lazily
        // avoids forcing every standalone consumer to install the mongo SDK.
        let MongoDBDriver: any;
        try {
            ({ MongoDBDriver } = await import('@objectstack/driver-mongodb' as any));
        } catch (err: any) {
            throw new Error(
                `[StandaloneStack] mongodb URL detected but @objectstack/driver-mongodb is not installed. ` +
                `Add it as a dependency or pass an explicit driverPlugin. (${err?.message ?? err})`
            );
        }
        driverPlugin = new DriverPlugin(new MongoDBDriver({ url: dbUrl }) as any);
    } else {
        // sqlite
        const { SqlDriver } = await import('@objectstack/driver-sql');
        const filename = dbUrl.replace(/^file:(\/\/)?/, '');
        if (!filename || /^[a-z][a-z0-9+.-]*:\/\//i.test(filename)) {
            throw new Error(
                `[StandaloneStack] sqlite driver was selected but the URL does not look like a file path: "${dbUrl}". ` +
                `Use file:/path/to/db.sqlite, or set OS_DATABASE_DRIVER explicitly.`
            );
        }
        mkdirSync(resolvePath(filename, '..'), { recursive: true });
        driverPlugin = new DriverPlugin(
            new SqlDriver({
                client: 'better-sqlite3',
                connection: { filename },
                useNullAsDefault: true,
            }),
        );
    }

    const artifactBundle = await loadArtifactBundle(artifactPath, {
        tag: '[StandaloneStack]',
        unwrapEnvelope: true,
    });
    if (artifactBundle) {
        const flowsCount = Array.isArray(artifactBundle?.flows) ? artifactBundle.flows.length : 'n/a';
        // eslint-disable-next-line no-console
        console.warn(
            `[StandaloneStack] artifact loaded: path=${artifactPath} keys=${Object.keys(artifactBundle).join(',')} flows=${flowsCount}`,
        );
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
