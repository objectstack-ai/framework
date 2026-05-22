// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0008 PR-10b — SysMetadataRepository tests.
 *
 * Exercises the round-trip behaviour against a fake engine. The fake is
 * intentionally minimal — we are testing the repository's adherence to
 * the MetadataRepository contract, not the engine itself.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConflictError, hashSpec } from '@objectstack/metadata-core';
import { SysMetadataRepository } from './sys-metadata-repository.js';

interface Row {
    id: string;
    type: string;
    name: string;
    organization_id: string | null;
    metadata: string;
    _hash: string;
    state: string;
    version: number;
    created_at: string;
    updated_at: string;
}

/** In-memory fake honoring just enough of the engine surface. */
function makeFakeEngine() {
    const rows = new Map<string, Row>();
    const keyOf = (where: Record<string, unknown>) =>
        `${where.type}|${where.name}|${String(where.organization_id ?? 'null')}`;

    return {
        rows,
        async find(_t: string, opts: { where: Record<string, unknown> }) {
            return Array.from(rows.values()).filter((r) => {
                if (opts.where.type && r.type !== opts.where.type) return false;
                if (opts.where.organization_id !== undefined
                    && r.organization_id !== opts.where.organization_id) return false;
                if (opts.where.state && r.state !== opts.where.state) return false;
                return true;
            });
        },
        async findOne(_t: string, opts: { where: Record<string, unknown> }) {
            return rows.get(keyOf(opts.where)) ?? null;
        },
        async insert(_t: string, data: Record<string, unknown>) {
            const k = keyOf(data);
            const row: Row = { id: `r_${rows.size + 1}`, ...(data as any) };
            rows.set(k, row);
            return { id: row.id };
        },
        async update(_t: string, data: Record<string, unknown>, opts: { where: Record<string, unknown> }) {
            const k = keyOf(opts.where);
            const cur = rows.get(k);
            if (!cur) throw new Error('not found');
            rows.set(k, { ...cur, ...(data as any) });
            return { id: cur.id };
        },
        async delete(_t: string, opts: { where: Record<string, unknown> }) {
            const k = keyOf(opts.where);
            const had = rows.delete(k);
            return { deleted: had ? 1 : 0 };
        },
    };
}

describe('SysMetadataRepository', () => {
    let engine: ReturnType<typeof makeFakeEngine>;
    let repo: SysMetadataRepository;

    const sampleView = {
        name: 'case_grid',
        label: 'Cases',
        object: 'case',
        columns: [{ field: 'name' }],
    };

    beforeEach(() => {
        engine = makeFakeEngine();
        repo = new SysMetadataRepository({
            engine,
            organizationId: 'org_alpha',
            orgLabel: 'org_alpha',
        });
    });

    // ── basic CRUD ──────────────────────────────────────────────────

    it('put creates a new row and returns the hash version', async () => {
        const result = await repo.put(
            { org: 'org_alpha', project: 'default', branch: 'main', type: 'view', name: 'case_grid' },
            sampleView,
            { parentVersion: null, actor: 'studio' },
        );
        expect(result.version).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(result.version).toBe(hashSpec(sampleView));
        expect(result.seq).toBe(1);
        expect(engine.rows.size).toBe(1);
    });

    it('get returns the stored item with canonical body', async () => {
        const ref = { org: 'org_alpha', project: 'default', branch: 'main', type: 'view' as const, name: 'case_grid' };
        await repo.put(ref, sampleView, { parentVersion: null, actor: 'studio' });
        const got = await repo.get(ref);
        expect(got).not.toBeNull();
        expect(got!.body).toEqual(sampleView);
        expect(got!.hash).toBe(hashSpec(sampleView));
    });

    it('get returns null when row is absent', async () => {
        const got = await repo.get({
            org: 'org_alpha', project: 'default', branch: 'main',
            type: 'view', name: 'missing',
        });
        expect(got).toBeNull();
    });

    // ── optimistic locking ──────────────────────────────────────────

    it('put rejects when parentVersion does not match HEAD', async () => {
        const ref = { org: 'org_alpha', project: 'default', branch: 'main', type: 'view' as const, name: 'case_grid' };
        const first = await repo.put(ref, sampleView, { parentVersion: null, actor: 'studio' });

        await expect(
            repo.put(ref, { ...sampleView, label: 'X' }, { parentVersion: 'sha256:wrong', actor: 'studio' }),
        ).rejects.toBeInstanceOf(ConflictError);

        // Threading the actual parentVersion succeeds.
        const second = await repo.put(
            ref,
            { ...sampleView, label: 'X' },
            { parentVersion: first.version, actor: 'studio' },
        );
        expect(second.version).not.toBe(first.version);
    });

    it('put rejects when row already exists but caller expected absence', async () => {
        const ref = { org: 'org_alpha', project: 'default', branch: 'main', type: 'view' as const, name: 'case_grid' };
        await repo.put(ref, sampleView, { parentVersion: null, actor: 'studio' });
        await expect(
            repo.put(ref, sampleView, { parentVersion: null, actor: 'studio' }),
        ).rejects.toBeInstanceOf(ConflictError);
    });

    it('put with identical body is a no-op (no seq bump)', async () => {
        const ref = { org: 'org_alpha', project: 'default', branch: 'main', type: 'view' as const, name: 'case_grid' };
        const first = await repo.put(ref, sampleView, { parentVersion: null, actor: 'studio' });
        const second = await repo.put(ref, sampleView, { parentVersion: first.version, actor: 'studio' });
        expect(second.version).toBe(first.version);
        // No new event => seqCounter unchanged.
        const third = await repo.put(
            ref, { ...sampleView, label: 'New' }, { parentVersion: first.version, actor: 'studio' },
        );
        expect(third.seq).toBe(2); // first was 1; identical no-op didn't consume a seq
    });

    // ── delete ──────────────────────────────────────────────────────

    it('delete removes the row when parentVersion matches', async () => {
        const ref = { org: 'org_alpha', project: 'default', branch: 'main', type: 'view' as const, name: 'case_grid' };
        const first = await repo.put(ref, sampleView, { parentVersion: null, actor: 'studio' });
        await repo.delete(ref, { parentVersion: first.version, actor: 'studio' });
        expect(engine.rows.size).toBe(0);
        expect(await repo.get(ref)).toBeNull();
    });

    it('delete throws ConflictError on parentVersion mismatch', async () => {
        const ref = { org: 'org_alpha', project: 'default', branch: 'main', type: 'view' as const, name: 'case_grid' };
        await repo.put(ref, sampleView, { parentVersion: null, actor: 'studio' });
        await expect(
            repo.delete(ref, { parentVersion: 'sha256:wrong', actor: 'studio' }),
        ).rejects.toBeInstanceOf(ConflictError);
    });

    it('delete throws on absent row', async () => {
        await expect(
            repo.delete(
                { org: 'org_alpha', project: 'default', branch: 'main', type: 'view', name: 'missing' },
                { parentVersion: 'sha256:anything', actor: 'studio' },
            ),
        ).rejects.toBeInstanceOf(ConflictError);
    });

    // ── whitelist enforcement (mirrors PR-10a, at the repo layer) ───

    it('put refuses non-allowOrgOverride types (object)', async () => {
        await expect(
            repo.put(
                { org: 'org_alpha', project: 'default', branch: 'main', type: 'object', name: 'case' },
                { name: 'case', label: 'Case', fields: {} },
                { parentVersion: null, actor: 'studio' },
            ),
        ).rejects.toMatchObject({ code: 'not_overridable', status: 403 });
    });

    it('put refuses non-allowOrgOverride types (flow)', async () => {
        await expect(
            repo.put(
                { org: 'org_alpha', project: 'default', branch: 'main', type: 'flow', name: 'on_create' },
                { name: 'on_create' },
                { parentVersion: null, actor: 'studio' },
            ),
        ).rejects.toMatchObject({ code: 'not_overridable', status: 403 });
    });

    // ── list ────────────────────────────────────────────────────────

    it('list yields headers for stored items, body stripped', async () => {
        await repo.put(
            { org: 'org_alpha', project: 'default', branch: 'main', type: 'view', name: 'a' },
            { name: 'a', columns: [] },
            { parentVersion: null, actor: 'studio' },
        );
        await repo.put(
            { org: 'org_alpha', project: 'default', branch: 'main', type: 'view', name: 'b' },
            { name: 'b', columns: [] },
            { parentVersion: null, actor: 'studio' },
        );
        const headers: any[] = [];
        for await (const h of repo.list({ type: 'view' })) headers.push(h);
        expect(headers).toHaveLength(2);
        expect(headers[0]).not.toHaveProperty('body');
        expect(headers[0]).toHaveProperty('hash');
        expect(headers[0]).toHaveProperty('ref');
    });

    // ── watch ───────────────────────────────────────────────────────

    it('watch delivers events to subscribers', async () => {
        const received: any[] = [];
        const iter = repo.watch({ type: 'view' });
        const ai = iter[Symbol.asyncIterator]();

        // Background consumer.
        const consume = (async () => {
            for (let i = 0; i < 2; i += 1) {
                const r = await ai.next();
                if (r.done) break;
                received.push(r.value);
            }
        })();

        // Give the iterator a tick to register before firing events.
        await new Promise((r) => setTimeout(r, 0));
        await repo.put(
            { org: 'org_alpha', project: 'default', branch: 'main', type: 'view', name: 'one' },
            { name: 'one' }, { parentVersion: null, actor: 'studio' },
        );
        await repo.put(
            { org: 'org_alpha', project: 'default', branch: 'main', type: 'view', name: 'two' },
            { name: 'two' }, { parentVersion: null, actor: 'studio' },
        );

        await consume;
        await ai.return!();

        expect(received).toHaveLength(2);
        expect(received[0].op).toBe('create');
        expect(received[0].ref.name).toBe('one');
        expect(received[1].ref.name).toBe('two');
    });

    it('watch filters by type', async () => {
        const received: any[] = [];
        const iter = repo.watch({ type: 'dashboard' });
        const ai = iter[Symbol.asyncIterator]();

        const consume = (async () => {
            const r = await ai.next();
            if (!r.done) received.push(r.value);
        })();

        await new Promise((r) => setTimeout(r, 0));
        // View event should be filtered out.
        await repo.put(
            { org: 'org_alpha', project: 'default', branch: 'main', type: 'view', name: 'v1' },
            { name: 'v1' }, { parentVersion: null, actor: 'studio' },
        );
        // Dashboard event should arrive.
        await repo.put(
            { org: 'org_alpha', project: 'default', branch: 'main', type: 'dashboard', name: 'd1' },
            { name: 'd1' }, { parentVersion: null, actor: 'studio' },
        );

        await consume;
        await ai.return!();
        expect(received).toHaveLength(1);
        expect(received[0].ref.type).toBe('dashboard');
    });

    // ── history is a no-op in M0 ────────────────────────────────────

    it('history yields nothing in M0', async () => {
        const events: any[] = [];
        for await (const e of repo.history()) events.push(e);
        expect(events).toEqual([]);
    });

    // ── close ───────────────────────────────────────────────────────

    it('close prevents further reads/writes', () => {
        repo.close();
        return expect(
            repo.get({ org: 'org_alpha', project: 'default', branch: 'main', type: 'view', name: 'x' }),
        ).rejects.toThrow(/closed/);
    });
});
