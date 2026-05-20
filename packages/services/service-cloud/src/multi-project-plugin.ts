// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext } from '@objectstack/core';
import {
    SeedLoaderService,
    collectBundleHooks,
    collectBundleFunctions,
    collectBundleActions,
    actionBodyRunnerFactory,
    QuickJSScriptRunner,
} from '@objectstack/runtime';
import { SeedLoaderConfigSchema } from '@objectstack/spec/data';
import {
    DefaultEnvironmentDriverRegistry,
    type EnvironmentDriverRegistry,
    type SecretEncryptor,
} from './environment-registry.js';
import {
    DefaultProjectKernelFactory,
    type BasePluginsFactory,
    type AppBundleResolver,
} from './project-kernel-factory.js';
import { KernelManager } from './kernel-manager.js';
import type * as Contracts from '@objectstack/spec/contracts';

type IDataDriver = Contracts.IDataDriver;

/**
 * Lazy descriptor for a project template.
 */
export interface ProjectTemplate {
    id: string;
    label: string;
    description: string;
    category?: string;
    load(): Promise<any>;
}

export interface TemplateSeeder {
    listTemplates(): Array<Pick<ProjectTemplate, 'id' | 'label' | 'description' | 'category'>>;
    seed(params: { projectId: string; templateId: string }): Promise<void>;
    seedBundle(params: { projectId: string; bundle: any }): Promise<void>;
}

export interface MultiProjectPluginConfig {
    controlDriver: IDataDriver;
    basePlugins: BasePluginsFactory;
    appBundles?: AppBundleResolver;
    templates?: Record<string, ProjectTemplate>;
    encryptor?: SecretEncryptor;
    cacheTTLMs?: number;
    maxSize?: number;
    ttlMs?: number;
    /** Direct storage adapter for artifact publishing. Bypasses kernel.getService('file-storage'). */
    storage?: any;
    /** Adapter name (e.g. 's3', 'local') — used when persisting sys_project_revision rows. */
    storageAdapterName?: string;
}

interface ExtractedItem {
    type: string;
    name: string;
    data: unknown;
}

function extractMetadataItems(bundle: any): ExtractedItem[] {
    const items: ExtractedItem[] = [];

    const pushAll = (type: string, arr?: any[]) => {
        for (const item of arr ?? []) {
            if (!item?.name) continue;
            items.push({ type, name: item.name, data: item });
        }
    };

    pushAll('object', bundle?.objects);
    pushAll('view', bundle?.views);
    pushAll('dashboard', bundle?.dashboards);
    pushAll('report', bundle?.reports);
    pushAll('flow', bundle?.flows);
    pushAll('agent', bundle?.agents);
    pushAll('app', bundle?.apps);
    pushAll('action', bundle?.actions);

    return items;
}

function namespaceDatasets(bundle: any): any[] {
    const datasets = Array.isArray(bundle?.data) ? bundle.data : [];
    return datasets;
}

function createTemplateSeeder(
    kernelManager: KernelManager,
    templates: Record<string, ProjectTemplate>,
    envRegistry: EnvironmentDriverRegistry,
    publishCtx: { controlDriver: IDataDriver; getStorage: () => any | Promise<any> | null; storageAdapter: string; keyPrefix: string },
): TemplateSeeder {
    const seedBundleForProject = async (projectId: string, bundle: any): Promise<void> => {
        const items = bundle ? extractMetadataItems(bundle) : [];
        const dataSets = bundle ? namespaceDatasets(bundle) : [];

        if (items.length === 0 && dataSets.length === 0) return;

        const kernel = await kernelManager.getOrCreate(projectId);

        let metadata: any;
        try {
            metadata = await kernel.getServiceAsync('metadata');
        } catch (err: any) {
            throw new Error(
                `metadata service unavailable for project ${projectId}: ${err?.message ?? err}`,
            );
        }
        if (!metadata || typeof metadata.bulkRegister !== 'function') {
            throw new Error(
                `metadata.bulkRegister unavailable for project ${projectId} (got ${metadata ? typeof metadata : 'null'})`,
            );
        }

        const engine: any = await kernel.getServiceAsync('objectql').catch(() => null);
        if (!engine) {
            throw new Error(
                `objectql engine unavailable for project ${projectId} — metadata persistence would be in-memory only`,
            );
        }
        if (typeof metadata.setDataEngine === 'function') {
            const cached = envRegistry.peekById(projectId);
            const orgId = (cached?.project as any)?.organization_id as string | undefined;
            try { metadata.setDataEngine(engine, orgId, projectId); } catch { /* already set */ }
        }

        if (items.length > 0) {
            const result: any = await metadata.bulkRegister(items, { continueOnError: true });
            const failed = result?.failed ?? 0;
            if (failed > 0) {
                const errs = (result?.errors ?? [])
                    .slice(0, 5)
                    .map((e: any) => `${e?.type}/${e?.name}: ${e?.error ?? 'unknown'}`)
                    .join('; ');
                throw new Error(
                    `bulkRegister reported ${failed} failures for project ${projectId}: ${errs}`,
                );
            }
        }

        if (items.length > 0 && typeof engine?.registerApp === 'function') {
            try { (engine as any).registerApp(bundle); } catch { /* best effort */ }
        }

        // Wire declarative hooks + their handler functions onto the engine.
        // `engine.registerApp(bundle)` only registers schema + hook *names*;
        // the actual handler-binding step (which AppPlugin.onInstall does in
        // standalone mode) must be replicated here so hooks fire when records
        // are mutated through this project kernel. Without this, runtime
        // bundles loaded via `metadata.artifact_path` (cloud mode) silently
        // skip beforeInsert/afterInsert/etc. handlers.
        if (typeof engine?.bindHooks === 'function') {
            const hooks = collectBundleHooks(bundle);
            const functions = collectBundleFunctions(bundle);
            if (hooks.length > 0 || Object.keys(functions).length > 0) {
                try {
                    engine.bindHooks(hooks, { engine, functions });
                } catch (err: any) {
                    // Non-fatal — schema is still registered; only handlers
                    // are missing. Log loudly so the operator can investigate.
                    // eslint-disable-next-line no-console
                    console.error(
                        `[MultiProjectPlugin] bindHooks failed for project ${projectId}:`,
                        err?.message ?? err,
                    );
                }
            }
        }

        // Wire declarative Action bodies. Symmetric with hooks above:
        // `engine.registerApp(bundle)` only persists schema metadata — it
        // does NOT install action handlers. Without this loop, any action
        // shipped with a metadata `body` (extracted by the CLI from inline
        // `execute:` arrow functions) would be unreachable through
        // `POST /api/v1/projects/:projectId/actions/...`.
        if (typeof engine?.registerAction === 'function') {
            const actions = collectBundleActions(bundle);
            if (actions.length > 0) {
                const actionBodyRunner = actionBodyRunnerFactory(new QuickJSScriptRunner(), {
                    ql: engine,
                    appId: projectId,
                });
                let registered = 0;
                for (const action of actions) {
                    const handler = actionBodyRunner(action);
                    if (!handler) continue;
                    const objectKey =
                        typeof action.object === 'string' && action.object.length > 0
                            ? action.object
                            : 'global';
                    try {
                        engine.registerAction(
                            objectKey,
                            action.name,
                            handler,
                            `app:${projectId}`,
                        );
                        registered++;
                    } catch (err: any) {
                        // eslint-disable-next-line no-console
                        console.warn(
                            `[MultiProjectPlugin] registerAction failed for ${objectKey}.${action.name} in project ${projectId}:`,
                            err?.message ?? err,
                        );
                    }
                }
                if (registered > 0) {
                    // eslint-disable-next-line no-console
                    console.log(
                        `[MultiProjectPlugin] Bound ${registered} action body(s) for project ${projectId}`,
                    );
                }
            }
        }

        // Ensure physical tables exist for the bundle's objects. We bypass
        // engine.syncSchemas() (which iterates *all* registered objects
        // across the kernel — including platform objects whose drivers may
        // not be wired) and instead drive `initObjects` per-driver for the
        // bundle's own object set. This is the same code path that
        // AppPlugin.onInstall takes in standalone mode.
        const bundleObjectsRaw: any = (bundle as any)?.objects;
        const bundleObjects: any[] = Array.isArray(bundleObjectsRaw)
            ? bundleObjectsRaw
            : (bundleObjectsRaw && typeof bundleObjectsRaw === 'object' ? Object.values(bundleObjectsRaw) : []);
        if (bundleObjects.length > 0) {
            const driverGroups = new Map<any, any[]>();
            for (const obj of bundleObjects) {
                let driver: any;
                try { driver = (engine as any).getDriverForObject?.(obj.name) ?? (engine as any).defaultDriver; }
                catch { driver = (engine as any).defaultDriver; }
                if (!driver || typeof driver.initObjects !== 'function') continue;
                if (!driverGroups.has(driver)) driverGroups.set(driver, []);
                driverGroups.get(driver)!.push(obj);
            }
            for (const [driver, objs] of driverGroups) {
                try {
                    await driver.initObjects(objs);
                } catch (err: any) {
                    // Non-fatal — schema is registered but the physical
                    // table couldn't be created. Surface so the operator
                    // can investigate (mismatched datasource binding,
                    // permission errors, etc.). Subsequent inserts will
                    // fail with `no such table` from the SQL driver.
                    // eslint-disable-next-line no-console
                    console.error(
                        `[MultiProjectPlugin] initObjects failed for project ${projectId}:`,
                        err?.message ?? err,
                    );
                }
            }
        }

        if (dataSets.length > 0) {
            const seedLoader = new SeedLoaderService(engine, metadata, console as any);
            const config = SeedLoaderConfigSchema.parse({});
            await seedLoader.load({ datasets: dataSets, config });
        }

        const driverWithFlush = await (kernel as any).getServiceAsync?.('driver').catch?.(() => null)
            ?? (kernel as any).services?.driver
            ?? null;
        const flushable = typeof driverWithFlush?.flush === 'function'
            ? driverWithFlush
            : null;
        if (flushable) {
            try { await flushable.flush(); } catch { /* best effort */ }
        }

        // Publish the seeded bundle as a sys_project_revision so the
        // artifact API serves it to remote runtimes (objectos in cloud
        // mode reads `GET /cloud/projects/:id/artifact`). Without this
        // step, the seeded data only lives in this project's metadata
        // DB on the cloud container's filesystem and is invisible to
        // any other process.
        let publishStatus: { stage: string; ok: boolean; error?: string; detail?: any } = {
            stage: 'start', ok: false,
        };
        try {
            const storage = await Promise.resolve(publishCtx.getStorage());
            publishStatus.stage = 'getStorage';
            publishStatus.detail = {
                hasStorage: !!storage,
                storageType: storage ? (storage.constructor?.name ?? typeof storage) : 'null',
                bundleHasObjects: Array.isArray(bundle?.objects) ? bundle.objects.length : 0,
                bundleHasApps: Array.isArray(bundle?.apps) ? bundle.apps.length : 0,
                bundleHasViews: Array.isArray(bundle?.views) ? bundle.views.length : 0,
                lastServiceKeys: (publishCtx as any)._lastServiceKeys ?? null,
            };
            if (!storage) {
                publishStatus.error = 'no-file-storage-service';
                console.warn(
                    `[MultiProjectPlugin] No file-storage service registered; skipping artifact publish for project ${projectId}.`,
                );
            } else {
                publishStatus.stage = 'findProject';
                const projectRow = await (publishCtx.controlDriver as any).findOne(
                    'sys_environment',
                    { where: { id: projectId } },
                );
                if (projectRow) {
                    publishStatus.stage = 'publishProjectRevision';
                    const { publishProjectRevision } = await import('./cloud-artifact-helpers.js');
                    await publishProjectRevision({
                        driver: publishCtx.controlDriver,
                        storage,
                        storageAdapter: publishCtx.storageAdapter,
                        keyPrefix: publishCtx.keyPrefix,
                        project: { id: projectRow.id, organization_id: projectRow.organization_id },
                        bundle,
                        note: 'template-seed',
                    });
                    publishStatus.ok = true;
                    publishStatus.stage = 'done';
                    console.log(`[MultiProjectPlugin] Published artifact bundle for project ${projectId}`);
                } else {
                    publishStatus.error = 'project-not-found';
                }
            }
        } catch (err: any) {
            publishStatus.error = err?.message ?? String(err);
            publishStatus.detail = { ...(publishStatus.detail ?? {}), stack: err?.stack };
            console.error(
                `[MultiProjectPlugin] Failed to publish seeded artifact for project ${projectId}:`,
                err?.stack ?? err?.message ?? err,
            );
        }
        // Persist publish diagnostic into sys_project.metadata.publishStatus so
        // operators can see why publish skipped without container logs.
        try {
            const cur = await (publishCtx.controlDriver as any).findOne('sys_environment', { where: { id: projectId } });
            const meta = cur && typeof cur.metadata === 'string'
                ? JSON.parse(cur.metadata)
                : (cur?.metadata ?? {});
            await (publishCtx.controlDriver as any).update(
                'sys_environment',
                projectId,
                { metadata: JSON.stringify({ ...meta, publishStatus, publishStatusAt: new Date().toISOString() }) },
            );
        } catch (diagErr: any) {
            console.error('[MultiProjectPlugin] Failed to write publishStatus diagnostic:', diagErr?.message ?? diagErr);
        }
    };

    return {
        listTemplates() {
            return Object.values(templates).map(({ id, label, description, category }) => ({
                id,
                label,
                description,
                category,
            }));
        },

        async seed({ projectId, templateId }) {
            const writeDiag = async (stage: string, extra: any = {}) => {
                try {
                    const cur = await (publishCtx.controlDriver as any).findOne('sys_environment', { where: { id: projectId } });
                    const meta = cur && typeof cur.metadata === 'string' ? JSON.parse(cur.metadata) : (cur?.metadata ?? {});
                    const seedDiag = { ...(meta.seedDiag ?? {}), [stage]: { at: new Date().toISOString(), ...extra } };
                    await (publishCtx.controlDriver as any).update('sys_environment', projectId, {
                        metadata: JSON.stringify({ ...meta, seedDiag }),
                    });
                } catch (e: any) { console.error('[MultiProjectPlugin] writeDiag failed', stage, e?.message); }
            };
            await writeDiag('seedCalled', { templateId, templates: Object.keys(templates) });
            const template = templates[templateId];
            if (!template) {
                await writeDiag('seedNotFound', { templateId });
                throw new Error(
                    `Unknown template: '${templateId}'. Available: [${Object.keys(templates).join(', ')}]`,
                );
            }
            let bundle: any;
            try {
                bundle = await template.load();
                await writeDiag('templateLoaded', {
                    objects: Array.isArray(bundle?.objects) ? bundle.objects.length : 'n/a',
                    apps: Array.isArray(bundle?.apps) ? bundle.apps.length : 'n/a',
                    views: Array.isArray(bundle?.views) ? bundle.views.length : 'n/a',
                    data: Array.isArray(bundle?.data) ? bundle.data.length : 'n/a',
                    bundleKeys: bundle ? Object.keys(bundle) : null,
                });
            } catch (e: any) {
                await writeDiag('templateLoadError', { error: e?.message, stack: e?.stack?.split('\n').slice(0,5) });
                throw e;
            }
            try {
                await seedBundleForProject(projectId, bundle);
                await writeDiag('seedBundleDone');
            } catch (e: any) {
                await writeDiag('seedBundleError', { error: e?.message, stack: e?.stack?.split('\n').slice(0,5) });
                throw e;
            }
        },

        async seedBundle({ projectId, bundle }) {
            await seedBundleForProject(projectId, bundle);
        },
    };
}

/**
 * Control-plane plugin that stands up the per-project orchestration layer.
 * Registers `env-registry`, `kernel-manager` and `template-seeder` on the
 * control kernel.
 */
export class MultiProjectPlugin implements Plugin {
    readonly name = 'com.objectstack.runtime.multi-project';
    readonly version = '1.0.0';

    private readonly config: MultiProjectPluginConfig;
    private kernelManager?: KernelManager;

    constructor(config: MultiProjectPluginConfig) {
        this.config = config;
    }

    init = async (ctx: PluginContext): Promise<void> => {
        const envRegistry: EnvironmentDriverRegistry = new DefaultEnvironmentDriverRegistry({
            controlPlaneDriver: this.config.controlDriver,
            encryptor: this.config.encryptor,
            cacheTTLMs: this.config.cacheTTLMs,
        });

        // Wrap the user-supplied resolver so bundles also come from packages
        // installed into the project via the marketplace UI. The marketplace
        // writes rows into `sys_package_installation`; for each row we look up
        // the corresponding manifest in the host kernel's SchemaRegistry and
        // reuse it as a project-scoped AppPlugin bundle.
        const userResolver = this.config.appBundles;
        const controlDriver = this.config.controlDriver;
        const hostKernel: any = ctx.kernel;

        /**
         * Pull installed-package bundles for `projectId` from the control
         * plane. Returns one bundle per installed manifest_id whose package is
         * present in the host kernel's package registry.
         */
        const resolveInstalledBundles = async (projectId: string): Promise<any[]> => {
            try {
                const findRows = async (table: string, where: any) => {
                    const r: any = await (controlDriver as any).find(table, { where, limit: 1000 });
                    if (Array.isArray(r)) return r;
                    if (r && Array.isArray(r.value)) return r.value;
                    return [];
                };
                const installs = await findRows('sys_package_installation', {
                    environment_id: projectId,
                });
                if (installs.length === 0) return [];

                // Optionally consult the host kernel's in-memory package
                // registry as a fallback when sys_package_version.manifest_json
                // is missing (e.g. seeded data without snapshot).
                const qlService: any = (() => {
                    try { return hostKernel?.getService?.('objectql'); } catch { return null; }
                })();
                const pkgRegistry = qlService?.registry;
                const allHostPackages: any[] = pkgRegistry?.getAllPackages?.() ?? [];

                const out: any[] = [];
                for (const inst of installs) {
                    if (inst.enabled === false || inst.enabled === 0) continue;
                    if (!inst?.package_version_id && !inst?.package_id) continue;

                    // 1) Try manifest_json snapshot from sys_package_version
                    let manifest: any = null;
                    let manifestId: string | undefined;
                    if (inst.package_version_id) {
                        const verRows = await findRows('sys_package_version', { id: inst.package_version_id });
                        const verRow = verRows[0];
                        if (verRow?.manifest_json) {
                            try {
                                manifest = typeof verRow.manifest_json === 'string'
                                    ? JSON.parse(verRow.manifest_json)
                                    : verRow.manifest_json;
                            } catch { /* invalid JSON — fall through */ }
                        }
                    }

                    // Resolve manifest_id (for fallback lookup + bundle metadata)
                    if (inst.package_id) {
                        const pkgRows = await findRows('sys_package', { id: inst.package_id });
                        manifestId = pkgRows[0]?.manifest_id;
                    }

                    // 2) Fallback: in-memory host registry by manifest_id
                    if (!manifest && manifestId) {
                        const entry = allHostPackages.find(
                            (p: any) => (p?.manifest?.id ?? p?.id ?? p?.manifest?.name) === manifestId,
                        );
                        manifest = entry?.manifest ?? entry;
                    }

                    if (!manifest) {
                        console.warn(
                            `[MultiProjectPlugin] No manifest available for install (manifest_id='${manifestId}', version_id='${inst.package_version_id}')`,
                        );
                        continue;
                    }
                    out.push({ manifest, packageId: manifestId ?? manifest?.id });
                }
                return out;
            } catch (err: any) {
                console.error(
                    `[MultiProjectPlugin] Failed to resolve installed bundles for '${projectId}':`,
                    err?.stack ?? err?.message ?? err,
                );
                return [];
            }
        };

        const wrappedResolver: AppBundleResolver = {
            async resolve(project) {
                const baseBundles = userResolver ? await userResolver.resolve(project) : [];
                const installedBundles = await resolveInstalledBundles(project.id);

                // Dedupe by manifest id — file-based bundles take precedence
                // over installed bundles when both reference the same id.
                const seen = new Set<string>();
                const merged: any[] = [];
                for (const b of [...baseBundles, ...installedBundles]) {
                    const sys = b?.manifest || b;
                    const key = sys?.id ?? sys?.name ?? Math.random().toString();
                    if (seen.has(key)) continue;
                    seen.add(key);
                    merged.push(b);
                }
                return merged;
            },
        };

        const factory = new DefaultProjectKernelFactory({
            controlPlaneDriver: this.config.controlDriver,
            basePlugins: this.config.basePlugins,
            appBundles: wrappedResolver,
            envRegistry,
            encryptor: this.config.encryptor,
        });

        const kernelManager = new KernelManager({
            factory,
            maxSize: this.config.maxSize,
            ttlMs: this.config.ttlMs,
        });
        this.kernelManager = kernelManager;

        const directStorage = this.config.storage ?? null;
        const directStorageAdapter = this.config.storageAdapterName
            ?? (process.env.OS_STORAGE_ADAPTER ?? 'local').toLowerCase();
        const seeder = createTemplateSeeder(
            kernelManager,
            this.config.templates ?? {},
            envRegistry,
            {
                controlDriver: this.config.controlDriver,
                storageAdapter: directStorageAdapter,
                keyPrefix: process.env.OS_STORAGE_KEY_PREFIX ?? 'artifacts',
                getStorage: async () => {
                    // 1. Direct storage adapter (preferred — set by cloud-stack
                    //    via resolveStorageFromEnv to bypass kernel.getService
                    //    lookup which is unreliable through the proxy wrapper).
                    if (directStorage && typeof directStorage.upload === 'function') {
                        return directStorage;
                    }
                    // 2. Fallback to kernel service lookup (for any stack that
                    //    forgot to pass `storage` in MultiProjectPluginConfig).
                    try {
                        const sync = (hostKernel as any).getService?.('file-storage');
                        if (sync && typeof sync.upload === 'function') return sync;
                    } catch { /* ignore */ }
                    try {
                        const async = await (hostKernel as any).getServiceAsync?.('file-storage');
                        if (async && typeof async.upload === 'function') return async;
                    } catch { /* ignore */ }
                    return null;
                },
            },
        );

        ctx.registerService('env-registry', envRegistry);
        ctx.registerService('kernel-manager', kernelManager);
        ctx.registerService('template-seeder', seeder);

        ctx.logger.info?.('MultiProjectPlugin: registered env-registry + kernel-manager + template-seeder');
    };

    destroy = async (): Promise<void> => {
        try { await this.kernelManager?.evictAll(); } catch { /* best effort */ }
    };
}
