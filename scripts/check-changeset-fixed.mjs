#!/usr/bin/env node
/**
 * Validates that every publishable workspace package is enumerated in the
 * Changesets `fixed` group, so a new public package can never silently be
 * released out of lockstep with the rest of the monorepo.
 *
 * Run:  node scripts/check-changeset-fixed.mjs
 *
 * Exits with code 1 (and a clear diff) if:
 *   - A public (non-private) workspace package is missing from the
 *     `fixed` group in .changeset/config.json
 *   - A name listed in the `fixed` group no longer exists in the workspace
 *
 * The script intentionally has zero third-party dependencies so it can run
 * in minimal CI environments before `pnpm install`. It reads
 * pnpm-workspace.yaml directly and walks the workspace globs itself.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

/**
 * Minimal pnpm-workspace.yaml parser: extracts entries under the top-level
 * `packages:` key. Supports the `- pattern` list form used by this repo and
 * tolerates comments / blank lines. Avoids pulling in a YAML dependency.
 *
 * @returns {string[]}
 */
function readWorkspacePatterns() {
  const text = readFileSync(resolve(repoRoot, 'pnpm-workspace.yaml'), 'utf8');
  const lines = text.split(/\r?\n/);
  const patterns = [];
  let inPackages = false;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').replace(/\s+$/, '');
    if (!line.trim()) continue;
    if (/^packages\s*:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const m = /^\s+-\s+["']?([^"'\s]+)["']?\s*$/.exec(line);
      if (m) {
        patterns.push(m[1]);
        continue;
      }
      // Any other non-indented key ends the packages block.
      if (/^\S/.test(line)) inPackages = false;
    }
  }
  return patterns;
}

/**
 * Expand a single `pattern` like `packages/*` or `packages/services/*` into
 * concrete directory paths. Only supports the `*` wildcard at any single
 * path segment, which is what the repo uses.
 *
 * @param {string} pattern
 * @returns {string[]}
 */
function expandPattern(pattern) {
  const segments = pattern.split('/');
  /** @type {string[]} */
  let dirs = [repoRoot];
  for (const seg of segments) {
    /** @type {string[]} */
    const next = [];
    for (const dir of dirs) {
      if (seg === '*') {
        let entries;
        try {
          entries = readdirSync(dir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            next.push(join(dir, entry.name));
          }
        }
      } else {
        const candidate = join(dir, seg);
        try {
          if (statSync(candidate).isDirectory()) next.push(candidate);
        } catch {
          /* missing - skip */
        }
      }
    }
    dirs = next;
  }
  return dirs;
}

/** @returns {string[]} names of all non-private workspace packages */
function listPublicPackageNames() {
  const patterns = readWorkspacePatterns();
  const seen = new Set();
  const names = [];
  for (const pattern of patterns) {
    for (const dir of expandPattern(pattern)) {
      const pkgPath = join(dir, 'package.json');
      let pkg;
      try {
        pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      } catch {
        continue;
      }
      if (!pkg.name || pkg.private === true) continue;
      if (seen.has(pkg.name)) continue;
      seen.add(pkg.name);
      names.push(pkg.name);
    }
  }
  return names.sort();
}

function readFixedGroups() {
  const configPath = resolve(repoRoot, '.changeset/config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (!Array.isArray(config.fixed)) return [];
  return config.fixed;
}

function main() {
  const publicPackages = listPublicPackageNames();
  const fixedGroups = readFixedGroups();
  const fixed = new Set(fixedGroups.flat());

  const missing = publicPackages.filter((name) => !fixed.has(name));
  const stale = [...fixed]
    .filter((name) => !publicPackages.includes(name))
    .sort();

  if (missing.length === 0 && stale.length === 0) {
    console.log(
      `✓ .changeset/config.json "fixed" group is in sync with ${publicPackages.length} public workspace packages.`,
    );
    return;
  }

  console.error('✗ .changeset/config.json "fixed" group is out of sync.');
  if (missing.length > 0) {
    console.error(
      '\nPublic packages missing from "fixed" (add them to keep versions in lockstep):',
    );
    for (const name of missing) console.error(`  - ${name}`);
  }
  if (stale.length > 0) {
    console.error(
      '\nNames in "fixed" that no longer exist in the workspace (remove them):',
    );
    for (const name of stale) console.error(`  - ${name}`);
  }
  console.error(
    '\nEdit .changeset/config.json so the "fixed" group matches the public workspace, then re-run this script.',
  );
  process.exit(1);
}

main();

