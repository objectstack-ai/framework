// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectStack Server — Host Configuration
 *
 * Booted by `objectstack dev` / `objectstack serve` (see `package.json`).
 *
 * The CLI loads this file, registers the plugins below on a fresh
 * `ObjectKernel`, then auto-mounts the standard HTTP stack
 * (HonoServerPlugin, Setup, RestAPI, Dispatcher, I18nService).
 *
 * Our plugin list:
 *  1. `createControlPlanePlugins(...)` — ObjectQL + driver + tenant +
 *     system-project + auth/security/audit + metadata for `sys_*`.
 *  2. `MultiProjectPlugin` — registers `env-registry`, `kernel-manager`
 *     and `template-seeder` on the control kernel so HttpDispatcher can
 *     route requests to per-project kernels via hostname / X-Project-Id.
 *
 * The control-plane driver is selected from a single URL-style env var
 * (Turso/Prisma convention):
 *
 *   OBJECTSTACK_DATABASE_URL
 *     - unset                 → `file:./.objectstack/data/control.db`
 *     - `file:<path>` / path  → SQLite at that path (better-sqlite3)
 *     - `libsql://…`          → libSQL/Turso
 *     - `http(s)://…`         → libSQL/sqld over HTTP
 *
 *   OBJECTSTACK_DATABASE_AUTH_TOKEN — optional, for libSQL/HTTP URLs.
 */

import { resolve as resolvePath } from 'node:path';
import type { Contracts } from '@objectstack/spec';
import {
    MultiProjectPlugin,
    type BasePluginsFactory,
    type AppBundleResolver,
} from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { MetadataPlugin } from '@objectstack/metadata';
import { TursoDriver } from '@objectstack/driver-turso';
import { SqlDriver } from '@objectstack/driver-sql';
import { createControlPlanePlugins } from './server/control-plane-preset.js';
import { templateRegistry } from './server/templates/registry.js';

type IDataDriver = Contracts.IDataDriver;

/**
 * Resolve the control-plane driver from `OBJECTSTACK_DATABASE_URL`.
 *
 * `libsql:` / `http(s):` URLs → `TursoDriver`. Anything else is treated
 * as a SQLite filesystem path, stripping `file:` / `file://` prefixes
 * so `file:./x.db`, `file:///x.db`, and bare `./x.db` all resolve to
 * the same file.
 */
function buildControlDriver(): {
    driver: IDataDriver;
    driverName: 'sqlite' | 'turso';
    databaseUrl: string;
} {
    const raw = process.env.OBJECTSTACK_DATABASE_URL?.trim()
        || `file:${resolvePath(process.cwd(), '.objectstack/data/control.db')}`;

    if (/^(libsql|https?):\/\//i.test(raw)) {
        const driver = new TursoDriver({
            url: raw,
            authToken: process.env.OBJECTSTACK_DATABASE_AUTH_TOKEN,
        });
        return {
            driver: driver as unknown as IDataDriver,
            driverName: 'turso',
            databaseUrl: raw,
        };
    }

    const filename = raw.replace(/^file:(\/\/)?/, '');
    const driver = new SqlDriver({
        client: 'better-sqlite3',
        connection: { filename },
        useNullAsDefault: true,
    });
    return {
        driver: driver as unknown as IDataDriver,
        driverName: 'sqlite',
        databaseUrl: `file:${filename}`,
    };
}

const { driver: controlDriver, driverName, databaseUrl } = buildControlDriver();
console.log(`[Bootstrap] Control DB: ${databaseUrl} (${driverName})`);

const authSecret = process.env.AUTH_SECRET
    ?? 'dev-secret-please-change-in-production-min-32-chars';
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined)
    ?? (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : undefined)
    ?? `http://localhost:${process.env.PORT ?? 3000}`;

// Per-project kernels share a minimal base. Both ObjectQL and Metadata
// are scoped to `environmentId: projectId` so DatabaseLoader's env_id
// filter and `protocol.saveMetaItem` writes stay aligned across the
// physically-isolated project databases.
const basePlugins: BasePluginsFactory = ({ projectId }) => [
    new ObjectQLPlugin({ environmentId: projectId }),
    new MetadataPlugin({ watch: false, environmentId: projectId }),
];

// Example bundles are seeded into a project at provisioning time via
// the template-seeder — not pre-installed into every project kernel.
const appBundles: AppBundleResolver = {
    async resolve() { return []; },
};

export default {
    plugins: [
        ...createControlPlanePlugins({
            controlDriver,
            driverName,
            authSecret,
            baseUrl,
        }),
        new MultiProjectPlugin({
            controlDriver,
            basePlugins,
            appBundles,
            templates: templateRegistry,
            maxSize: Number(process.env.OBJECTSTACK_KERNEL_CACHE_SIZE ?? 32),
            ttlMs: Number(process.env.OBJECTSTACK_KERNEL_TTL_MS ?? 15 * 60 * 1000),
            cacheTTLMs: Number(process.env.OBJECTSTACK_ENV_CACHE_TTL_MS ?? 5 * 60 * 1000),
        }),
    ],
    // Project-scoping config consumed by `createRestApiPlugin` and
    // `createDispatcherPlugin` (auto-registered by `objectstack serve`).
    api: {
        enableProjectScoping: true,
        projectResolution: 'auto' as const,
    },
};
