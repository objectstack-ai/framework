// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import path from 'path';
import { resolveDefaultDevDbUrl } from './dev.js';

const CWD = '/proj/app';
const FILE = `file:${path.join(CWD, '.objectstack', 'data', 'dev.db')}`;

describe('resolveDefaultDevDbUrl — objectstack dev persists by default', () => {
  it('defaults to a project-anchored sqlite file when nothing else is chosen', () => {
    expect(resolveDefaultDevDbUrl({ env: {}, cwd: CWD })).toBe(FILE);
  });

  it('yields to an explicit --database flag', () => {
    expect(
      resolveDefaultDevDbUrl({ databaseFlag: 'postgres://x', env: {}, cwd: CWD }),
    ).toBeUndefined();
  });

  it('yields to --fresh (its own ephemeral temp DB)', () => {
    expect(
      resolveDefaultDevDbUrl({ freshDbUrl: 'file:/tmp/x/dev.db', env: {}, cwd: CWD }),
    ).toBeUndefined();
  });

  it('yields to OS_DATABASE_URL / DATABASE_URL env', () => {
    expect(
      resolveDefaultDevDbUrl({ env: { OS_DATABASE_URL: 'file:./custom.db' }, cwd: CWD }),
    ).toBeUndefined();
    expect(
      resolveDefaultDevDbUrl({ env: { DATABASE_URL: 'libsql://x' }, cwd: CWD }),
    ).toBeUndefined();
  });

  it('respects an explicit in-memory driver opt-out', () => {
    expect(
      resolveDefaultDevDbUrl({ databaseDriverFlag: 'memory', env: {}, cwd: CWD }),
    ).toBeUndefined();
    expect(
      resolveDefaultDevDbUrl({ env: { OS_DATABASE_DRIVER: 'memory' }, cwd: CWD }),
    ).toBeUndefined();
  });

  it('treats blank env values as unset (still defaults to file)', () => {
    expect(resolveDefaultDevDbUrl({ env: { OS_DATABASE_URL: '  ' }, cwd: CWD })).toBe(FILE);
  });
});
