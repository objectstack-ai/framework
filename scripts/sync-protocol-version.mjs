// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Re-sync the PROTOCOL_VERSION handshake constant with @objectstack/spec's
// package major. Runs as part of the root `version` script (changesets/action
// calls `pnpm run version` when preparing the release PR), so a spec major
// bump can never ship without the constant following — the drift class that
// broke main after the 14.0.0 release (#2769): the lockstep guard
// (protocol-version.test.ts) exists, but release PRs opened by
// changesets/action with the default GITHUB_TOKEN do not trigger CI (GitHub's
// anti-recursion rule), so the guard only fired AFTER the merge. Fixing the
// value at version time is the only spot that cannot be skipped.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkgPath = join(root, 'packages/spec/package.json');
const constPath = join(root, 'packages/spec/src/kernel/protocol-version.ts');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const major = Number.parseInt(String(pkg.version).split('.')[0], 10);
if (!Number.isInteger(major) || major < 1) {
  console.error(`✗ sync-protocol-version: cannot parse major from spec version '${pkg.version}'`);
  process.exit(1);
}

const src = readFileSync(constPath, 'utf8');
const re = /export const PROTOCOL_VERSION = '(\d+)\.0\.0';/;
const m = src.match(re);
if (!m) {
  console.error(`✗ sync-protocol-version: PROTOCOL_VERSION declaration not found in ${constPath}`);
  process.exit(1);
}

const current = Number.parseInt(m[1], 10);
if (current === major) {
  console.log(`✓ PROTOCOL_VERSION already ${major}.0.0 — in lockstep with @objectstack/spec@${pkg.version}`);
  process.exit(0);
}

writeFileSync(constPath, src.replace(re, `export const PROTOCOL_VERSION = '${major}.0.0';`));
console.log(`✓ PROTOCOL_VERSION ${current}.0.0 → ${major}.0.0 (lockstep with @objectstack/spec@${pkg.version})`);
