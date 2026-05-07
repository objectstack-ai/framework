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
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

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

    // Load the companion runtime ESM bundle (declarative handler code)
    // produced by `objectstack build`. Without this step every Hook would
    // boot with `handler === undefined` and silently no-op — see
    // packages/cli/src/utils/build-runtime.ts for the build side.
    if (artifactBundle && typeof artifactBundle.runtimeModule === 'string' && artifactBundle.runtimeModule.length > 0) {
        const ref = artifactBundle.runtimeModule as string;
        const moduleAbsPath = ref.startsWith('/')
            ? ref
            : resolvePath(artifactPath, '..', ref);
        try {
            const moduleUrl = `file://${moduleAbsPath}`;
            const mod: any = await import(moduleUrl);
            const fns = (mod && (mod.functions ?? mod.default?.functions)) ?? null;
            if (fns && typeof fns === 'object') {
                // Merge with any string-keyed functions already on the bundle
                // (legacy / Studio-injected handlers) without clobbering them.
                const existing = (artifactBundle.functions && typeof artifactBundle.functions === 'object' && !Array.isArray(artifactBundle.functions))
                    ? artifactBundle.functions as Record<string, unknown>
                    : {};
                artifactBundle.functions = { ...existing, ...fns };
                console.warn(
                    `[StandaloneStack] runtime module loaded: ${ref} (${Object.keys(fns).length} handler${Object.keys(fns).length === 1 ? '' : 's'})`,
                );
            } else {
                console.warn(`[StandaloneStack] runtime module ${ref} exported no \`functions\` map`);
            }
        } catch (err: any) {
            console.warn(`[StandaloneStack] runtime module load FAILED: path=${moduleAbsPath} error=${err?.message}`);
        }
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
