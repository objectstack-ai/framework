// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TEMPLATES, getCliVersion, detectPackageManager } from '../src/commands/init';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'),
);

describe('init command — published scaffold', () => {
  it('resolves the CLI version from its own package.json', () => {
    expect(getCliVersion()).toBe(pkg.version);
  });

  describe.each(Object.keys(TEMPLATES))('template "%s"', (key) => {
    const t = TEMPLATES[key];
    const allDeps = { ...t.dependencies, ...t.devDependencies };

    it('does not emit `workspace:` specifiers (would break outside the monorepo)', () => {
      for (const [name, range] of Object.entries(allDeps)) {
        expect(range, `${name} must not use workspace protocol`).not.toMatch(/^workspace:/);
      }
    });

    it('pins every @objectstack/* dep to the CLI version', () => {
      const expected = `^${pkg.version}`;
      for (const [name, range] of Object.entries(allDeps)) {
        if (name.startsWith('@objectstack/')) {
          expect(range, name).toBe(expected);
        }
      }
    });

    it('includes @objectstack/cli so package.json scripts can run', () => {
      // Every template's scripts invoke the `objectstack` binary, which is
      // provided by @objectstack/cli — the bug report showed `pnpm dev`
      // failing with `objectstack: command not found` because cli was
      // missing from devDependencies.
      const callsObjectstack = Object.values(t.scripts).some((s) =>
        s.split(/\s+/).includes('objectstack'),
      );
      if (callsObjectstack) {
        expect(allDeps['@objectstack/cli']).toBeDefined();
      }
    });
  });
});

describe('detectPackageManager', () => {
  it('detects pnpm from npm_config_user_agent', () => {
    expect(detectPackageManager({ npm_config_user_agent: 'pnpm/10.31.0 npm/? node/v22.0.0 linux x64' })).toBe('pnpm');
  });
  it('detects yarn', () => {
    expect(detectPackageManager({ npm_config_user_agent: 'yarn/4.0.0 npm/? node/v22.0.0 linux x64' })).toBe('yarn');
  });
  it('detects bun', () => {
    expect(detectPackageManager({ npm_config_user_agent: 'bun/1.1.0 node/v22.0.0 linux x64' })).toBe('bun');
  });
  it('defaults to npm when user agent is missing (e.g. npx)', () => {
    expect(detectPackageManager({})).toBe('npm');
  });
  it('defaults to npm for npm itself', () => {
    expect(detectPackageManager({ npm_config_user_agent: 'npm/10.0.0 node/v22.0.0 linux x64' })).toBe('npm');
  });
});
