// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectStack Server — Unified Bootstrap
 *
 * The same `apps/server` process can run in three shapes, selected by env:
 *
 *  - **single** (default, no env flag needed)
 *    Legacy single-kernel mode: register every plugin from
 *    `objectstack.config.ts` against one shared `ObjectKernel`. No control
 *    plane, no per-project routing. Best for OSS single-project deployments.
 *
 *  - **multi-project-local** (`OBJECTSTACK_MULTI_PROJECT=true`)
 *    Multi-project self-hosted: control-plane tables (sys_project, …) live
 *    in a local SQLite file (`OBJECTSTACK_CONTROL_DB`, defaults to
 *    `/data/control.db`). Projects are created via the Studio UI / REST API
 *    and each binds its own driver (sqlite file / Turso URL / …).
 *
 *  - **multi-project-remote** (`OBJECTSTACK_CONTROL_PLANE_URL` set)
 *    SaaS shape: control-plane tables live in a remote Turso DB. Same as
 *    local multi-project except the control driver is a TursoDriver.
 *
 * All three shapes share the same per-project kernel path:
 *   hostname → envRegistry.resolveByHostname() → kernelManager.getOrCreate()
 * so Studio + HTTP routes are identical regardless of where sys_* lives.
 */

import { resolve as resolvePath } from 'node:path';
import {
    ObjectKernel,
    KernelManager,
    DefaultProjectKernelFactory,
    DefaultEnvironmentDriverRegistry,
    type BasePluginsFactory,
    type AppBundleResolver,
    type EnvironmentDriverRegistry,
} from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { MetadataPlugin } from '@objectstack/metadata';
import { TursoDriver } from '@objectstack/driver-turso';
import { SqlDriver } from '@objectstack/driver-sql';
import type { Contracts } from '@objectstack/spec';
import { createControlPlanePlugins } from './control-plane-preset.js';

type IDataDriver = Contracts.IDataDriver;

/**
 * Public runtime mode — preserved for backwards compatibility with callers
 * that inspected this value. Internally we now distinguish three shapes.
 */
export type RuntimeMode = 'self-hosted' | 'cloud';

type ControlPlaneShape = 'single' | 'multi-project-local' | 'multi-project-remote';

export interface BootstrapResult {
    kernel: ObjectKernel;
    kernelManager?: KernelManager;
    envRegistry?: EnvironmentDriverRegistry;
    mode: RuntimeMode;
    /** Internal classification for logging / diagnostics. */
    shape: ControlPlaneShape;
}

export function resolveRuntimeMode(): RuntimeMode {
    const raw = process.env.OBJECTSTACK_RUNTIME_MODE?.toLowerCase();
    if (raw === 'cloud') return 'cloud';
    return 'self-hosted';
}

function resolveShape(): ControlPlaneShape {
    if (process.env.OBJECTSTACK_CONTROL_PLANE_URL) return 'multi-project-remote';
    if (process.env.OBJECTSTACK_MULTI_PROJECT === 'true') return 'multi-project-local';
    // Legacy: OBJECTSTACK_RUNTIME_MODE=cloud implies remote control plane.
    if (process.env.OBJECTSTACK_RUNTIME_MODE?.toLowerCase() === 'cloud') {
        return 'multi-project-remote';
    }
    return 'single';
}

/**
 * Single-kernel bootstrap — the legacy path. Registers every plugin declared
 * in `apps/server/objectstack.config.ts` against one shared `ObjectKernel`.
 */
async function bootstrapSingle(): Promise<BootstrapResult> {
    console.log('[Bootstrap] Shape: single');
    const kernel = new ObjectKernel();

    // stackConfig is imported dynamically so the multi-project shapes — which
    // never touch it — do not incur the Zod validation cost of the example
    // apps/plugins it references. A schema drift in one of the examples
    // shouldn't crash multi-project boots (or the E2E test harness) when
    // they don't need those bundles at all.
    const dyn = (spec: string) =>
        (new Function('s', 'return import(s)') as (s: string) => Promise<any>)(spec);
    const stackConfig = (await dyn('../objectstack.config.ts')).default;

    if (!stackConfig.plugins || stackConfig.plugins.length === 0) {
        throw new Error('[Bootstrap] No plugins found in stackConfig');
    }
    for (const plugin of stackConfig.plugins) {
        await kernel.use(plugin as any);
    }
    await kernel.bootstrap();
    return { kernel, mode: 'self-hosted', shape: 'single' };
}

/**
 * Build the control-plane driver based on the resolved shape.
 */
function buildControlDriver(
    shape: 'multi-project-local' | 'multi-project-remote',
): { driver: IDataDriver; driverName: string } {
    if (shape === 'multi-project-remote') {
        const url = process.env.TURSO_DATABASE_URL;
        if (!url) {
            throw new Error(
                '[Bootstrap] TURSO_DATABASE_URL is required when OBJECTSTACK_CONTROL_PLANE_URL is set.',
            );
        }
        const driver = new TursoDriver({
            url,
            authToken: process.env.TURSO_AUTH_TOKEN,
        });
        return { driver: driver as unknown as IDataDriver, driverName: 'turso' };
    }

    // multi-project-local
    const dbFile = process.env.OBJECTSTACK_CONTROL_DB
        ?? resolvePath(process.cwd(), '.objectstack/data/control.db');
    const driver = new SqlDriver({
        client: 'better-sqlite3',
        connection: { filename: dbFile },
        useNullAsDefault: true,
    });
    return { driver: driver as unknown as IDataDriver, driverName: 'sqlite' };
}

/**
 * Boot the control-plane kernel. This kernel owns the sys_* namespace —
 * project registry, credentials, members, auth. It also acts as the fallback
 * kernel for routes that are not project-scoped (discovery, auth, system
 * endpoints).
 */
async function bootstrapControlKernel(
    controlDriver: IDataDriver,
    driverName: string,
): Promise<ObjectKernel> {
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

    const plugins = createControlPlanePlugins({
        controlDriver,
        driverName,
        authSecret,
        baseUrl,
    });

    const kernel = new ObjectKernel();
    for (const plugin of plugins) {
        await kernel.use(plugin as any);
    }
    await kernel.bootstrap();
    return kernel;
}

/**
 * Multi-project bootstrap (both `local` and `remote` share this path).
 *
 * 1. Build the control-plane driver (local sqlite file or remote Turso).
 * 2. Boot the control-plane kernel with the preset plugin set.
 * 3. Wire up envRegistry + DefaultProjectKernelFactory + KernelManager.
 * 4. Return the control-plane kernel as the default kernel — per-project
 *    traffic switches to a project kernel inside HttpDispatcher.
 */
async function bootstrapMultiProject(
    shape: 'multi-project-local' | 'multi-project-remote',
): Promise<BootstrapResult> {
    console.log(`[Bootstrap] Shape: ${shape}`);

    const { driver: controlDriver, driverName } = buildControlDriver(shape);

    const envRegistry = new DefaultEnvironmentDriverRegistry({
        controlPlaneDriver: controlDriver,
        cacheTTLMs: Number(
            process.env.OBJECTSTACK_ENV_CACHE_TTL_MS ?? 5 * 60 * 1000,
        ),
    });

    // MVP app-bundle resolver.
    //
    // The example CRM / Todo / BI bundles are loaded lazily *and* gated on
    // an env flag so that:
    //   1. Test environments (E2E, unit tests) can skip them entirely —
    //      the example `defineStack(...)` configs perform their own Zod
    //      validation on import, so a single unrelated schema drift in
    //      an example would otherwise crash bootstrap for everyone.
    //   2. Production multi-project deployments that do not ship the
    //      reference apps (the typical case) avoid paying the cost.
    //
    // Set `OBJECTSTACK_BUNDLE_EXAMPLES=true` to get the legacy behaviour —
    // all three example bundles are attached to every project kernel.
    // Swap this resolver for a registry-backed one once
    // `sys_project_package` is consulted.
    const appBundles: AppBundleResolver = {
        async resolve() {
            if (process.env.OBJECTSTACK_BUNDLE_EXAMPLES !== 'true') {
                return [];
            }
            // Dynamic `new Function('return import(...)')(…)` sidesteps
            // TypeScript's static rootDir analysis — the example configs
            // live outside apps/server's tsconfig rootDir but are still
            // resolvable at runtime. Kept here intentionally so the tsc
            // typecheck doesn't need a dedicated include for examples.
            const dyn = (spec: string) =>
                (new Function('s', 'return import(s)') as (s: string) => Promise<any>)(spec);
            const [crm, todo, bi] = await Promise.all([
                dyn('../../../examples/app-crm/objectstack.config.ts'),
                dyn('../../../examples/app-todo/objectstack.config.ts'),
                dyn('../../../examples/plugin-bi/objectstack.config.ts'),
            ]);
            return [crm.default, todo.default, bi.default];
        },
    };

    // Per-project kernels only need the minimal base — driver is injected
    // by the factory. Additional service plugins (AI, automation, …) can
    // be added here when they are ready to run per-project.
    //
    // Both ObjectQL and Metadata are scoped to the project id via
    // `environmentId`. This keeps DatabaseLoader's baseFilter
    // (`env_id = <projectId>`) and protocol.saveMetaItem writes aligned,
    // so newly created objects are visible on the next read even though
    // every project already has its own physical database.
    const basePlugins: BasePluginsFactory = ({ projectId }) => [
        new ObjectQLPlugin({ environmentId: projectId }),
        new MetadataPlugin({ watch: false, environmentId: projectId }),
    ];

    const factory = new DefaultProjectKernelFactory({
        controlPlaneDriver: controlDriver,
        basePlugins,
        appBundles,
        envRegistry,
    });

    const kernelManager = new KernelManager({
        factory,
        maxSize: Number(process.env.OBJECTSTACK_KERNEL_CACHE_SIZE ?? 32),
        ttlMs: Number(process.env.OBJECTSTACK_KERNEL_TTL_MS ?? 15 * 60 * 1000),
    });

    const controlKernel = await bootstrapControlKernel(controlDriver, driverName);

    return {
        kernel: controlKernel,
        kernelManager,
        envRegistry,
        mode: shape === 'multi-project-remote' ? 'cloud' : 'self-hosted',
        shape,
    };
}

// ---------------------------------------------------------------------------
// Legacy exports — kept for tests / tooling that imports them directly.
// ---------------------------------------------------------------------------

export async function bootstrapSelfHosted(): Promise<BootstrapResult> {
    const shape = resolveShape();
    if (shape === 'multi-project-local') {
        return bootstrapMultiProject('multi-project-local');
    }
    return bootstrapSingle();
}

export async function bootstrapCloud(): Promise<BootstrapResult> {
    return bootstrapMultiProject('multi-project-remote');
}

export async function bootstrap(): Promise<BootstrapResult> {
    const shape = resolveShape();
    switch (shape) {
        case 'single':
            return bootstrapSingle();
        case 'multi-project-local':
            return bootstrapMultiProject('multi-project-local');
        case 'multi-project-remote':
            return bootstrapMultiProject('multi-project-remote');
    }
}
