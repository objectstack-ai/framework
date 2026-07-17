// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Regression: `createLogger({ file })` must actually write the file when the
// logger is consumed as ESM (#3110). `openFileStream` used to `require('fs')`
// to keep `fs` out of the browser bundle graph; esbuild rewrites that to its
// `__require` shim in the ESM output, which throws `Dynamic require of "fs" is
// not supported`, and the surrounding `catch {}` swallowed it. Every Node ESM
// consumer — `os serve`, `os dev`, the whole workspace is `type: module` —
// silently got no file logging, while the CJS build kept working.
//
// These have to bundle and spawn a real `node`: under vitest the source runs
// through vite-node, where `require` IS defined, so an in-process test of this
// code passes against the broken version. Exercising the shipped shape is the
// only thing that fails on the bug.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

let workdir: string;
let bundleHref: string;
let bundlePath: string;

// Mirrors the ESM half of tsup.config.ts — the logger entry, bundled, es2020.
// Keep in sync if that config's format/target change.
beforeAll(async () => {
    workdir = mkdtempSync(join(tmpdir(), 'os-logger-esm-'));
    bundlePath = join(workdir, 'logger.mjs');
    await build({
        entryPoints: [join(here, 'logger.ts')],
        outfile: bundlePath,
        bundle: true,
        format: 'esm',
        platform: 'node',
        target: 'es2020',
    });
    bundleHref = pathToFileURL(bundlePath).href;
}, 30_000);

afterAll(() => {
    rmSync(workdir, { recursive: true, force: true });
});

/** Run `body` as real Node ESM with `createLogger` imported from the bundle. */
function runEsm(body: string) {
    const source = `import { createLogger } from ${JSON.stringify(bundleHref)};\n${body}`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
        cwd: workdir,
        encoding: 'utf8',
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

describe('ObjectLogger file destination under ESM (#3110)', () => {
    it('writes the configured file when imported as ESM', () => {
        const logfile = join(workdir, 'app.log');
        const run = runEsm(`
const l = createLogger({ format: 'text', file: ${JSON.stringify(logfile)} });
l.info('hello from esm');
await l.destroy();
`);

        expect(run.stderr).toBe('');
        expect(run.status).toBe(0);
        expect(existsSync(logfile)).toBe(true);
        expect(readFileSync(logfile, 'utf8')).toContain('hello from esm');
    });

    it('does not reach esbuild\'s dynamic-require shim to load fs', () => {
        // The precise failure mode, asserted on the artifact so the diagnosis
        // stays attached to the test if a lazy `require` is ever reintroduced.
        const code = readFileSync(bundlePath, 'utf8');
        expect(code.slice(code.indexOf('openFileStream'))).not.toMatch(/__require\(["'](?:node:)?fs["']\)/);
    });

    it('reports an unusable file path on stderr instead of dropping it silently', () => {
        // A directory is never a valid log file. `createWriteStream` reports
        // EISDIR asynchronously, so this also covers the 'error' event: with no
        // listener it would be an uncaught exception and a non-zero exit.
        const run = runEsm(`
const l = createLogger({ format: 'text', file: ${JSON.stringify(workdir)} });
l.info('console logging must continue');
await l.destroy();
await new Promise((r) => setTimeout(r, 50));
console.log('SURVIVED');
`);

        expect(run.status).toBe(0);
        expect(run.stdout).toContain('console logging must continue');
        expect(run.stdout).toContain('SURVIVED');
        expect(run.stderr).toContain('file logging disabled');
    });

    it('keeps the shared stream alive when a child logger is destroyed', () => {
        // `child()` shares the opener's stream, so a child's teardown must not
        // end it: the parent's next write would hit 'write after end' — fatal,
        // and unreachable until file logging actually opened under ESM.
        const logfile = join(workdir, 'child.log');
        const run = runEsm(`
const parent = createLogger({ format: 'text', file: ${JSON.stringify(logfile)} });
const child = parent.child({ requestId: 'r1' });
child.info('from child');
await child.destroy();
parent.info('from parent after child teardown');
await parent.destroy();
`);

        expect(run.status).toBe(0);
        const contents = readFileSync(logfile, 'utf8');
        expect(contents).toContain('from child');
        expect(contents).toContain('from parent after child teardown');
    });
});
