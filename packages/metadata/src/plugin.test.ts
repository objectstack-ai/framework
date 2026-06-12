// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { MetadataPlugin } from './plugin';
import { NodeMetadataManager } from './node-metadata-manager';

vi.mock('@objectstack/core', async (orig) => {
    const real = (await orig()) as any;
    return {
        ...real,
        createLogger: () => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        }),
    };
});

describe('MetadataPlugin — bootstrap × watch coupling (D2)', () => {
    it('attaches a filesystem watcher in eager mode when watch=true', () => {
        const plugin = new MetadataPlugin({
            watch: true,
            config: { bootstrap: 'eager' },
        });
        const mgr = (plugin as any).manager as NodeMetadataManager;
        expect((mgr as any).watcher).toBeDefined();
        // Cleanup
        return mgr.stopWatching();
    });

    it('attaches a filesystem watcher in lazy mode when watch=true', () => {
        const plugin = new MetadataPlugin({
            watch: true,
            config: { bootstrap: 'lazy' },
        });
        const mgr = (plugin as any).manager as NodeMetadataManager;
        expect((mgr as any).watcher).toBeDefined();
        return mgr.stopWatching();
    });

    it('NEVER attaches a filesystem watcher in artifact-only mode', () => {
        const plugin = new MetadataPlugin({
            watch: true, // explicitly requested — must be ignored
            config: { bootstrap: 'artifact-only' },
        });
        const mgr = (plugin as any).manager as NodeMetadataManager;
        expect((mgr as any).watcher).toBeUndefined();
    });

    it('honors watch=false in eager mode', () => {
        const plugin = new MetadataPlugin({
            watch: false,
            config: { bootstrap: 'eager' },
        });
        const mgr = (plugin as any).manager as NodeMetadataManager;
        expect((mgr as any).watcher).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PR-10e regression: artifact view items have no top-level `name`. Their
// identity is the target object (encoded in `list.data.object` /
// `form.data.object`). When `_parseAndRegisterArtifact` consumes a
// compiled artifact it must derive the view name from the inner data
// source — otherwise views are silently SKIPPED and reads through
// `metadataService.get('view', <object>)` return undefined, falling
// back to the boot-time SchemaRegistry copy and breaking HMR data
// reload.
// ─────────────────────────────────────────────────────────────────────────
describe('MetadataPlugin._parseAndRegisterArtifact — view name resolution (PR-10e)', () => {
    it('registers view items by their target object even when top-level `name` is absent', async () => {
        const plugin = new MetadataPlugin({
            watch: false,
            config: { bootstrap: 'eager' },
            environmentId: 'proj_test',
        });
        const mgr = (plugin as any).manager as NodeMetadataManager;

        const fakeCtx = {
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        } as any;

        const artifact = {
            id: 'com.example.test',
            name: 'test',
            version: '0.0.0',
            type: 'app',
            scope: 'app',
            namespace: 'test',
            defaultDatasource: 'memory',
            views: [
                {
                    // intentionally NO top-level name — mirrors compiled artifact shape
                    list: { name: 'all_case', label: 'All Cases', type: 'grid',
                            data: { provider: 'object', object: 'case' }, columns: [] },
                    listViews: {
                        case_workflow: { name: 'case_workflow', label: 'Service Workflow', type: 'kanban',
                                         data: { provider: 'object', object: 'case' }, columns: [] },
                    },
                },
            ],
        };

        await (plugin as any)._parseAndRegisterArtifact(fakeCtx, artifact, 'test-artifact');

        const registered = await mgr.get('view', 'case');
        expect(registered).toBeDefined();
        const label = (registered as any)?.listViews?.case_workflow?.label;
        expect(label).toBe('Service Workflow');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// Filesystem-scanner provenance: when the host declares its package id
// (options.packageId — the project's `defineStack` manifest id), scanned
// source-file metadata must be stamped `_packageId`/`_provenance` exactly
// like the artifact path, so GET /meta consumers (objectui
// NavigationSyncEffect) can tell code-defined items from user-authored
// rows. Without the option, items must stay unstamped — `_packageId`
// feeds isArtifactBacked() write authorization.
// ─────────────────────────────────────────────────────────────────────────
describe('MetadataPlugin._loadFromFileSystem — package provenance stamping', () => {
    const fakeCtx = {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    } as any;

    it('stamps _packageId/_provenance on scanned items when options.packageId is set', async () => {
        const plugin = new MetadataPlugin({
            watch: false,
            config: { bootstrap: 'eager' },
            packageId: 'com.example.proj',
        });
        const mgr = (plugin as any).manager as NodeMetadataManager;
        vi.spyOn(mgr, 'loadMany').mockImplementation(async (type: string) =>
            type === 'page' ? [{ name: 'home_page', label: 'Home' }] : []);

        await (plugin as any)._loadFromFileSystem(fakeCtx);

        const item = await mgr.get('page', 'home_page') as any;
        expect(item).toBeDefined();
        expect(item._packageId).toBe('com.example.proj');
        expect(item._provenance).toBe('package');
    });

    it('does not overwrite an item\'s pre-existing _packageId', async () => {
        const plugin = new MetadataPlugin({
            watch: false,
            config: { bootstrap: 'eager' },
            packageId: 'com.example.proj',
        });
        const mgr = (plugin as any).manager as NodeMetadataManager;
        vi.spyOn(mgr, 'loadMany').mockImplementation(async (type: string) =>
            type === 'page' ? [{ name: 'vendor_page', _packageId: 'com.vendor.pkg' }] : []);

        await (plugin as any)._loadFromFileSystem(fakeCtx);

        const item = await mgr.get('page', 'vendor_page') as any;
        expect(item._packageId).toBe('com.vendor.pkg');
        expect(item._provenance).toBe('package');
    });

    it('leaves scanned items unstamped when options.packageId is not configured', async () => {
        const plugin = new MetadataPlugin({
            watch: false,
            config: { bootstrap: 'eager' },
        });
        const mgr = (plugin as any).manager as NodeMetadataManager;
        vi.spyOn(mgr, 'loadMany').mockImplementation(async (type: string) =>
            type === 'page' ? [{ name: 'plain_page', label: 'Plain' }] : []);

        await (plugin as any)._loadFromFileSystem(fakeCtx);

        const item = await mgr.get('page', 'plain_page') as any;
        expect(item).toBeDefined();
        expect(item._packageId).toBeUndefined();
        expect(item._provenance).toBeUndefined();
    });
});
