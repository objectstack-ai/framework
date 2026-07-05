// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { applyMappingToRows, type MappingArtifactLike } from './import-mapping';

const artifact = (fieldMapping: MappingArtifactLike['fieldMapping']): MappingArtifactLike => ({
    name: 'm', targetObject: 'o', fieldMapping,
});

describe('applyMappingToRows — transform semantics', () => {
    it('none renames; output is a strict projection (unmapped columns drop)', () => {
        const r = applyMappingToRows(
            [{ A: '1', Junk: 'x' }],
            artifact([{ source: 'A', target: 'a', transform: 'none' }]),
        );
        expect(r).toEqual({ ok: true, rows: [{ a: '1' }] });
    });

    it('constant writes params.value regardless of the source cell', () => {
        const r = applyMappingToRows(
            [{ A: 'whatever' }],
            artifact([{ source: 'A', target: 'tier', transform: 'constant', params: { value: 'gold' } }]),
        );
        expect(r).toEqual({ ok: true, rows: [{ tier: 'gold' }] });
    });

    it('map translates known values and passes unknown ones through', () => {
        const r = applyMappingToRows(
            [{ S: 'Open' }, { S: 'Weird' }],
            artifact([{ source: 'S', target: 's', transform: 'map', params: { valueMap: { Open: 'draft' } } }]),
        );
        expect(r).toEqual({ ok: true, rows: [{ s: 'draft' }, { s: 'Weird' }] });
    });

    it('split fans one column into positional targets (missing parts → undefined)', () => {
        const r = applyMappingToRows(
            [{ Name: 'John Doe' }, { Name: 'Cher' }],
            artifact([{ source: 'Name', target: ['first', 'last'], transform: 'split', params: { separator: ' ' } }]),
        );
        expect(r).toEqual({ ok: true, rows: [{ first: 'John', last: 'Doe' }, { first: 'Cher', last: undefined }] });
    });

    it('join concatenates source columns, skipping empties', () => {
        const r = applyMappingToRows(
            [{ City: 'Berlin', Street: 'Unter den Linden' }, { City: 'Rome', Street: '' }],
            artifact([{ source: ['City', 'Street'], target: 'address', transform: 'join', params: { separator: ', ' } }]),
        );
        expect(r).toEqual({ ok: true, rows: [{ address: 'Berlin, Unter den Linden' }, { address: 'Rome' }] });
    });

    it('lookup copies the raw value through (metaMap resolves it downstream)', () => {
        const r = applyMappingToRows(
            [{ Owner: '张三' }],
            artifact([{ source: 'Owner', target: 'owner', transform: 'lookup' }]),
        );
        expect(r).toEqual({ ok: true, rows: [{ owner: '张三' }] });
    });

    it('rejects an unknown transform loudly', () => {
        const r = applyMappingToRows(
            [{ A: '1' }],
            artifact([{ source: 'A', target: 'a', transform: 'zip' as never }]),
        );
        expect(r).toMatchObject({ ok: false, status: 400, code: 'UNSUPPORTED_TRANSFORM' });
    });
});
