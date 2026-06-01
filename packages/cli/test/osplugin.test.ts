// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, afterAll } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type ArchiveFile,
  MANIFEST_FILENAME,
  SIGNATURE_FILENAME,
  computeIntegrity,
  createTar,
  createTarGz,
  sriDigest,
} from '../src/utils/osplugin.js';
import PluginBuild from '../src/commands/plugin/build.js';

/** Minimal ustar reader used to prove our writer is standards-compliant. */
function readTar(buf: Buffer): Record<string, { data: Buffer; magic: string; chksumOk: boolean }> {
  const files: Record<string, { data: Buffer; magic: string; chksumOk: boolean }> = {};
  let off = 0;
  while (off + 512 <= buf.length) {
    const name = buf.toString('utf8', off, off + 100).replace(/\0.*$/s, '');
    if (!name) break; // zero block → end of archive
    const size = parseInt(buf.toString('ascii', off + 124, off + 136).replace(/\0.*$/s, '').trim(), 8);
    const magic = buf.toString('ascii', off + 257, off + 263);
    const storedChksum = parseInt(buf.toString('ascii', off + 148, off + 156).replace(/\0.*$/s, '').trim(), 8);
    // Recompute checksum with the chksum field treated as spaces.
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : buf[off + i];
    files[name] = {
      data: buf.subarray(off + 512, off + 512 + size),
      magic,
      chksumOk: sum === storedChksum,
    };
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

describe('osplugin: integrity', () => {
  it('sriDigest uses the SRI sha256-<base64> format', () => {
    const d = sriDigest(new Uint8Array(Buffer.from('hello')));
    expect(d).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/);
    // Canonical SRI vector for "hello".
    expect(d).toBe('sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=');
  });

  it('computeIntegrity excludes the manifest and SIGNATURE and sorts keys', () => {
    const files: ArchiveFile[] = [
      { path: 'dist/b.mjs', data: new Uint8Array(Buffer.from('b')) },
      { path: 'dist/a.mjs', data: new Uint8Array(Buffer.from('a')) },
      { path: MANIFEST_FILENAME, data: new Uint8Array(Buffer.from('{}')) },
      { path: SIGNATURE_FILENAME, data: new Uint8Array(Buffer.from('unsigned')) },
    ];
    const integrity = computeIntegrity(files);
    expect(Object.keys(integrity)).toEqual(['dist/a.mjs', 'dist/b.mjs']);
    expect(integrity['dist/a.mjs']).toBe(sriDigest(new Uint8Array(Buffer.from('a'))));
  });
});

describe('osplugin: archive', () => {
  const files: ArchiveFile[] = [
    { path: 'dist/index.mjs', data: new Uint8Array(Buffer.from('export const x = 1;\n')) },
    { path: MANIFEST_FILENAME, data: new Uint8Array(Buffer.from('{"id":"a"}\n')) },
  ];

  it('createTar produces standards-compliant ustar entries (readable + valid checksums)', () => {
    const tar = createTar(files);
    const read = readTar(tar);
    expect(Object.keys(read).sort()).toEqual(['dist/index.mjs', MANIFEST_FILENAME].sort());
    for (const name of Object.keys(read)) {
      expect(read[name].magic).toBe('ustar\0');
      expect(read[name].chksumOk).toBe(true);
    }
    expect(read['dist/index.mjs'].data.toString('utf8')).toBe('export const x = 1;\n');
  });

  it('createTarGz emits a valid gzip stream that gunzips back to the tar', () => {
    const gz = createTarGz(files);
    expect(gz[0]).toBe(0x1f); // gzip magic
    expect(gz[1]).toBe(0x8b);
    const tar = gunzipSync(gz);
    expect(readTar(tar)[MANIFEST_FILENAME].data.toString('utf8')).toBe('{"id":"a"}\n');
  });

  it('is reproducible — identical inputs yield byte-identical archives', () => {
    expect(Buffer.compare(createTarGz(files), createTarGz([...files].reverse()))).toBe(0);
  });
});

describe('os plugin build (end-to-end)', () => {
  let dir: string;
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('bundles, computes integrity, and packs a readable .osplugin', async () => {
    dir = await mkdtemp(join(tmpdir(), 'osplugin-'));
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(
      join(dir, MANIFEST_FILENAME),
      JSON.stringify({
        id: 'com.acme.demo',
        name: 'Demo',
        version: '1.0.0',
        type: 'plugin',
        runtime: 'sandbox',
        packaging: 'bundled',
        main: 'src/index.ts',
        permissions: { services: ['object'], hooks: ['record.beforeInsert'] },
        engines: { platform: '>=4.0 <5', protocol: '>=1.0' },
      }),
    );
    await writeFile(join(dir, 'src', 'index.ts'), `export const hello = (): string => 'hi';\n`);

    await PluginBuild.run([dir]);

    const blob = await readFile(join(dir, 'com.acme.demo-1.0.0.osplugin'));
    const tar = readTar(gunzipSync(blob));
    expect(tar['dist/index.mjs']).toBeDefined();
    expect(tar[MANIFEST_FILENAME]).toBeDefined();
    expect(tar[SIGNATURE_FILENAME]).toBeDefined();

    const compiled = JSON.parse(tar[MANIFEST_FILENAME].data.toString('utf8'));
    expect(compiled.id).toBe('com.acme.demo');
    expect(compiled.main).toBe('dist/index.mjs');
    // integrity is SRI over the bundled file and matches its bytes.
    expect(compiled.integrity['dist/index.mjs']).toBe(
      sriDigest(new Uint8Array(tar['dist/index.mjs'].data)),
    );
    // @objectstack/* would be externalized; the trivial bundle has no imports.
    expect(tar['dist/index.mjs'].data.toString('utf8')).toContain('hello');
  });
});
