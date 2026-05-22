// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, expect, it } from 'vitest';
import { runDryRun, type LegacyMetadataRow } from '../scripts/dry-run-hash-compat';

/**
 * PR-10d.1 tests — verify the dry-run probe correctly classifies the kinds
 * of rows we expect to find in legacy `sys_metadata` data.
 *
 * Each fixture mirrors a real-world shape we know production has written via
 * `protocol.ts:saveMetaItem` (line 1840+): `metadata` is `JSON.stringify(item)`
 * where `item` is whatever the caller passed — typically a Zod-validated view
 * or dashboard body. Shapes vary in nesting, key order, locale strings, etc.
 */

const validView = (overrides: Record<string, unknown> = {}) => ({
    id: 'r1',
    type: 'view',
    name: 'case_grid',
    organization_id: 'org_alpha',
    state: 'active',
    metadata: JSON.stringify({
        name: 'case_grid',
        type: 'grid',
        label: 'Cases',
        columns: [
            { field: 'id', width: 80 },
            { field: 'title', width: 240 },
        ],
        ...overrides,
    }),
});

describe('runDryRun — happy path', () => {
    it('returns compatible:true for a clean snapshot', () => {
        const report = runDryRun([
            validView(),
            { ...validView(), id: 'r2', name: 'case_kanban' },
            { ...validView(), id: 'r3', type: 'dashboard', name: 'home' },
        ]);
        expect(report.compatible).toBe(true);
        expect(report.okRows).toBe(3);
        expect(report.findings).toHaveLength(0);
    });

    it('reports type distribution', () => {
        const report = runDryRun([
            validView(),
            { ...validView(), id: 'r2', name: 'a' },
            { ...validView(), id: 'r3', name: 'b' },
            { ...validView(), id: 'r4', type: 'dashboard', name: 'home' },
        ]);
        expect(report.typeDistribution).toEqual({ view: 3, dashboard: 1 });
    });

    it('handles legacy keys in non-canonical order (round-trip hash is stable)', () => {
        // Production code does `JSON.stringify(item)` which preserves insertion
        // order. Different writers produce different orderings. canonicalize()
        // must absorb this.
        const a: LegacyMetadataRow = {
            id: 'r1',
            type: 'view',
            name: 'case_grid',
            organization_id: 'org_alpha',
            state: 'active',
            metadata: JSON.stringify({ z: 1, a: 2, m: { y: 9, b: 8 } }),
        };
        const b: LegacyMetadataRow = {
            id: 'r2',
            type: 'view',
            name: 'case_kanban',
            organization_id: 'org_alpha',
            state: 'active',
            metadata: JSON.stringify({ a: 2, m: { b: 8, y: 9 }, z: 1 }),
        };
        const report = runDryRun([a, b]);
        expect(report.compatible).toBe(true);
        expect(report.findings).toHaveLength(0);
    });
});

describe('runDryRun — error classification', () => {
    it('flags missing metadata column', () => {
        const report = runDryRun([
            { id: 'r1', type: 'view', name: 'x', organization_id: null, state: 'active', metadata: null },
        ]);
        expect(report.compatible).toBe(false);
        expect(report.findings[0].code).toBe('missing_metadata');
    });

    it('flags invalid JSON', () => {
        const report = runDryRun([
            {
                id: 'r1',
                type: 'view',
                name: 'x',
                organization_id: null,
                state: 'active',
                metadata: '{not json',
            },
        ]);
        expect(report.compatible).toBe(false);
        expect(report.findings[0].code).toBe('invalid_json');
    });

    it('flags non-object body (array)', () => {
        const report = runDryRun([
            {
                id: 'r1',
                type: 'view',
                name: 'x',
                organization_id: null,
                state: 'active',
                metadata: JSON.stringify([1, 2, 3]),
            },
        ]);
        expect(report.compatible).toBe(false);
        expect(report.findings[0].code).toBe('non_object_body');
    });

    it('flags non-object body (primitive)', () => {
        const report = runDryRun([
            {
                id: 'r1',
                type: 'view',
                name: 'x',
                organization_id: null,
                state: 'active',
                metadata: JSON.stringify('a string'),
            },
        ]);
        expect(report.compatible).toBe(false);
        expect(report.findings[0].code).toBe('non_object_body');
    });

    it('flags duplicate overlay key on (type, name, organization_id)', () => {
        const report = runDryRun([
            validView(),
            { ...validView(), id: 'r2' },   // same type+name+org
        ]);
        expect(report.compatible).toBe(false);
        expect(report.findings.some((f) => f.code === 'duplicate_overlay_key')).toBe(true);
        expect(report.duplicateKeys).toContain('view|case_grid|org_alpha');
    });

    it('does NOT flag duplicates across different organizations', () => {
        const report = runDryRun([
            validView(),
            { ...validView(), id: 'r2', organization_id: 'org_beta' },
        ]);
        expect(report.compatible).toBe(true);
    });

    it('does NOT flag duplicates when one row is archived', () => {
        const report = runDryRun([
            { ...validView(), state: 'archived' },
            { ...validView(), id: 'r2' },
        ]);
        expect(report.compatible).toBe(true);
    });

    it('aggregates multiple findings across rows', () => {
        const report = runDryRun([
            validView(),
            {
                id: 'r2',
                type: 'view',
                name: 'bad',
                organization_id: null,
                state: 'active',
                metadata: '{broken',
            },
            {
                id: 'r3',
                type: 'view',
                name: 'arr',
                organization_id: null,
                state: 'active',
                metadata: '[]',
            },
        ]);
        expect(report.totalRows).toBe(3);
        expect(report.okRows).toBe(1);
        expect(report.findings).toHaveLength(2);
        expect(report.findings.map((f) => f.code).sort()).toEqual([
            'invalid_json',
            'non_object_body',
        ]);
    });
});

describe('runDryRun — boundary conditions', () => {
    it('handles empty snapshot', () => {
        const report = runDryRun([]);
        expect(report.compatible).toBe(true);
        expect(report.totalRows).toBe(0);
        expect(report.okRows).toBe(0);
    });

    it('handles row with deeply nested body', () => {
        const deep = (() => {
            let acc: any = { leaf: true };
            for (let i = 0; i < 20; i++) acc = { wrap: acc };
            return acc;
        })();
        const report = runDryRun([
            {
                id: 'r1',
                type: 'view',
                name: 'deep',
                organization_id: null,
                state: 'active',
                metadata: JSON.stringify(deep),
            },
        ]);
        expect(report.compatible).toBe(true);
    });

    it('handles unicode and special chars in body', () => {
        const report = runDryRun([
            {
                id: 'r1',
                type: 'view',
                name: 'i18n',
                organization_id: null,
                state: 'active',
                metadata: JSON.stringify({
                    label: '案件视图',
                    description: 'スペシャル "quoted" chars \\ and newlines\n',
                    emoji: '🚀',
                }),
            },
        ]);
        expect(report.compatible).toBe(true);
    });
});
