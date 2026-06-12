// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * LocalManifestSource — the local desired-state ledger (cloud ADR-0007 ⑤).
 * Pure local file operations: list/read/has/write/remove, corrupt-file
 * tolerance, and manifest-id sanitisation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalManifestSource, type InstalledManifestEntry } from './local-manifest-source.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'lms-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const entry = (manifestId: string, version = '1.0.0'): InstalledManifestEntry => ({
    packageId: `pkg_${manifestId}`,
    versionId: version,
    manifestId,
    version,
    manifest: { id: manifestId, version },
    installedAt: '2026-06-12T00:00:00.000Z',
    installedBy: 'user-1',
});

describe('LocalManifestSource', () => {
    it('starts empty and lists nothing for a missing directory', () => {
        const src = new LocalManifestSource(join(dir, 'does-not-exist-yet'));
        expect(src.list()).toEqual([]);
        expect(src.read('com.acme.crm')).toBeNull();
        expect(src.has('com.acme.crm')).toBe(false);
    });

    it('write → has/read/list round-trips and upserts by manifestId', () => {
        const src = new LocalManifestSource(dir);
        src.write(entry('com.acme.crm'));
        expect(src.has('com.acme.crm')).toBe(true);
        expect(src.read('com.acme.crm')?.version).toBe('1.0.0');

        src.write(entry('com.acme.crm', '1.1.0')); // upsert, same file
        expect(src.list()).toHaveLength(1);
        expect(src.read('com.acme.crm')?.version).toBe('1.1.0');
    });

    it('remove deletes the entry and reports absence', () => {
        const src = new LocalManifestSource(dir);
        src.write(entry('com.acme.crm'));
        expect(src.remove('com.acme.crm')).toBe(true);
        expect(src.remove('com.acme.crm')).toBe(false);
        expect(src.list()).toEqual([]);
    });

    it('skips corrupt ledger files in list() and nulls them in read()', () => {
        const src = new LocalManifestSource(dir);
        src.write(entry('com.acme.good'));
        writeFileSync(join(dir, 'com.acme.bad.json'), '{not json', 'utf8');
        expect(src.list().map((e) => e.manifestId)).toEqual(['com.acme.good']);
        expect(src.read('com.acme.bad')).toBeNull();
    });

    it('sanitises hostile manifest ids into safe filenames', () => {
        const src = new LocalManifestSource(dir);
        src.write(entry('../../etc/passwd'));
        // Stored INSIDE the ledger dir, traversal characters replaced.
        const files = readdirSync(dir);
        expect(files).toHaveLength(1);
        expect(files[0]).not.toContain('/');
        expect(src.has('../../etc/passwd')).toBe(true);
    });
});
