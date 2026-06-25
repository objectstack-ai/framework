// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Regression: the `os dev` artifact-reload path (HMR POST handler + server-side
// artifact-file watcher) must announce a generic `metadata:reloaded` hook AFTER
// re-loading the artifact into the MetadataManager. Runtime consumers that cached
// boot-time metadata re-sync on that signal — notably the automation engine,
// which re-binds flow triggers (incl. scheduled jobs) it pulled once at boot.
// Without the announce, an edited schedule-triggered flow keeps firing its
// pre-edit definition until a full restart.

import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MetadataPlugin } from './plugin';
import type { NodeMetadataManager } from './node-metadata-manager';

function fakeCtx() {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        trigger: vi.fn(async () => {}),
    } as any;
}

function writeArtifact(flowName: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'os-hmr-'));
    const file = join(dir, 'objectstack.json');
    const artifact = {
        id: 'com.example.test',
        name: 'test',
        version: '0.0.0',
        type: 'app',
        scope: 'app',
        namespace: 'test',
        defaultDatasource: 'memory',
        flows: [
            {
                name: flowName,
                label: flowName,
                type: 'schedule',
                runAs: 'system',
                nodes: [
                    { id: 'start', type: 'start', label: 'Start', config: { schedule: { type: 'interval', intervalMs: 1000 } } },
                    { id: 'end', type: 'end', label: 'End' },
                ],
                edges: [{ id: 'e1', source: 'start', target: 'end' }],
            },
        ],
    };
    writeFileSync(file, JSON.stringify(artifact), 'utf8');
    return file;
}

describe('MetadataPlugin._reloadAndAnnounce — fires metadata:reloaded after reload', () => {
    it('reloads the artifact into the manager THEN announces metadata:reloaded', async () => {
        const plugin = new MetadataPlugin({
            watch: false,
            config: { bootstrap: 'eager' },
            environmentId: 'proj_test',
        });
        const mgr = (plugin as any).manager as NodeMetadataManager;
        const ctx = fakeCtx();
        const file = writeArtifact('sweep');

        await (plugin as any)._reloadAndAnnounce(ctx, { path: file, fetchTimeoutMs: undefined }, [file]);

        // The fresh flow landed in the metadata manager (so the re-sync's
        // metadata.list('flow') will see the edited definition)…
        const registered = await mgr.get('flow', 'sweep');
        expect(registered).toBeDefined();

        // …and the generic reload signal fired with the changed path.
        expect(ctx.trigger).toHaveBeenCalledTimes(1);
        expect(ctx.trigger).toHaveBeenCalledWith('metadata:reloaded', { changed: [file] });
    });

    it('still announces even if a subscriber throws (reload must not break)', async () => {
        const plugin = new MetadataPlugin({
            watch: false,
            config: { bootstrap: 'eager' },
            environmentId: 'proj_test',
        });
        const ctx = fakeCtx();
        ctx.trigger = vi.fn(async () => { throw new Error('subscriber boom'); });
        const file = writeArtifact('sweep2');

        await expect(
            (plugin as any)._reloadAndAnnounce(ctx, { path: file, fetchTimeoutMs: undefined }, [file]),
        ).resolves.toBeUndefined();

        expect(ctx.trigger).toHaveBeenCalledTimes(1);
        expect(ctx.logger.warn).toHaveBeenCalled();
    });
});
