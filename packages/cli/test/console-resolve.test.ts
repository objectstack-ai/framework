// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * resolveConsolePath() hardening — stale out-of-workspace installs.
 *
 * Node module resolution from the consumer cwd climbs `node_modules`
 * directories all the way up the filesystem. A stray
 * `~/node_modules/@objectstack/console` left behind by an old npm
 * experiment used to win over the version-locked bundle and serve a
 * stale Console (browser-side OBJUI-001 "Unknown component type").
 * These tests pin the major-version guard that skips such candidates.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  resolveConsolePath,
  isConsoleVersionCompatible,
} from '../src/utils/console.js';

const CLI_VERSION = '9.2.0';

function writeConsolePackage(
  dir: string,
  { name = '@objectstack/console', version, withDist = true }: {
    name?: string;
    version: string;
    withDist?: boolean;
  },
): string {
  const pkgDir = path.join(dir, 'node_modules', '@objectstack', 'console');
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name, version }));
  if (withDist) {
    fs.mkdirSync(path.join(pkgDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'dist', 'index.html'), '<html></html>');
  }
  return pkgDir;
}

/** Fresh sandbox: <tmp>/home/project is the cwd, <tmp>/home simulates $HOME. */
function makeSandbox(): { home: string; project: string } {
  // realpath: node's require.resolve returns symlink-resolved paths, and
  // macOS tmpdir lives behind the /var -> /private/var symlink.
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'os-console-resolve-')));
  const home = path.join(root, 'home');
  const project = path.join(home, 'project');
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(
    path.join(project, 'package.json'),
    JSON.stringify({ name: 'consumer-app', version: '1.0.0' }),
  );
  return { home, project };
}

describe('isConsoleVersionCompatible', () => {
  it('accepts the same major', () => {
    expect(isConsoleVersionCompatible('9.2.0', '9.2.0')).toBe(true);
    expect(isConsoleVersionCompatible('9.0.1', '9.5.0')).toBe(true);
    expect(isConsoleVersionCompatible('9.3.0-beta.1', '9.2.0')).toBe(true);
  });

  it('rejects a different major', () => {
    expect(isConsoleVersionCompatible('7.8.0', '9.2.0')).toBe(false);
    expect(isConsoleVersionCompatible('10.0.0', '9.2.0')).toBe(false);
  });

  it('rejects missing or malformed versions', () => {
    expect(isConsoleVersionCompatible(undefined, '9.2.0')).toBe(false);
    expect(isConsoleVersionCompatible('', '9.2.0')).toBe(false);
    expect(isConsoleVersionCompatible('not-a-version', '9.2.0')).toBe(false);
  });
});

describe('resolveConsolePath version guard', () => {
  it('skips a stale major-mismatched install climbed to outside the project, with a warning', () => {
    const { home, project } = makeSandbox();
    // The incident shape: ~/node_modules/@objectstack/console@7.8.0 with a
    // built dist, reachable from the project cwd by climbing node_modules.
    const stale = writeConsolePackage(home, { version: '7.8.0' });

    const warnings: string[] = [];
    const result = resolveConsolePath({
      cwd: project,
      cliVersion: CLI_VERSION,
      warn: (m) => warnings.push(m),
    });

    expect(result).not.toBe(stale);
    expect(warnings.some((m) => m.includes('7.8.0') && m.includes(stale))).toBe(true);
  });

  it('accepts a same-major install climbed to from the project cwd', () => {
    const { home, project } = makeSandbox();
    const ok = writeConsolePackage(home, { version: '9.0.0' });

    const warnings: string[] = [];
    const result = resolveConsolePath({
      cwd: project,
      cliVersion: CLI_VERSION,
      warn: (m) => warnings.push(m),
    });

    expect(result).toBe(ok);
    expect(warnings).toEqual([]);
  });

  it('prefers a matching local install over a stale parent-directory one', () => {
    const { home, project } = makeSandbox();
    writeConsolePackage(home, { version: '7.8.0' });
    const local = writeConsolePackage(project, { version: '9.2.0' });

    const result = resolveConsolePath({
      cwd: project,
      cliVersion: CLI_VERSION,
      warn: () => {},
    });

    expect(result).toBe(local);
  });

  it('skips an install whose package.json carries no version', () => {
    const { home, project } = makeSandbox();
    const unversionedDir = path.join(home, 'node_modules', '@objectstack', 'console');
    fs.mkdirSync(path.join(unversionedDir, 'dist'), { recursive: true });
    fs.writeFileSync(
      path.join(unversionedDir, 'package.json'),
      JSON.stringify({ name: '@objectstack/console' }),
    );
    fs.writeFileSync(path.join(unversionedDir, 'dist', 'index.html'), '<html></html>');

    const warnings: string[] = [];
    const result = resolveConsolePath({
      cwd: project,
      cliVersion: CLI_VERSION,
      warn: (m) => warnings.push(m),
    });

    expect(result).not.toBe(unversionedDir);
    expect(warnings.some((m) => m.includes('unknown'))).toBe(true);
  });
});
