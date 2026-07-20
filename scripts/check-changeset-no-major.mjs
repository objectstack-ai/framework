#!/usr/bin/env node
/**
 * Launch-window guard: rejects any changeset that declares a `major` bump.
 *
 * Run:  node scripts/check-changeset-no-major.mjs
 *
 * WHY THIS EXISTS
 * ---------------
 * Every publishable package is enumerated in the Changesets `fixed` group
 * (see `.changeset/config.json` + `check-changeset-fixed.mjs`), so the whole
 * monorepo versions in LOCKSTEP. Changesets applies the HIGHEST bump found
 * across the group to EVERY package in it. That means a single `major` on any
 * one package — even a tiny spec helper — silently promotes the entire release
 * (all ~70 packages) from e.g. `14.2.0` to `15.0.0`.
 *
 * During the launch window we ship breaking changes as `minor` (pre-1.0
 * semantics: a breaking change does not burn a major version number while the
 * stack is in lockstep). This guard makes that convention enforceable instead
 * of tribal, so an over-strict `major` marker can never again turn an ordinary
 * PR into a whole-stack major release by accident.
 *
 * Exits with code 1 (and a clear list of offenders) if any changeset frontmatter
 * bumps a package `major`.
 *
 * RC EXEMPTION: when Changesets is in pre-release mode (`.changeset/pre.json`
 * with `"mode": "pre"`, entered via `changeset pre enter <tag>`), a `major`
 * bump only ever produces a `X.0.0-<tag>.N` PRE-RELEASE version — nothing final
 * publishes until `changeset pre exit`. Accumulating the next major's breaking
 * changes is precisely what an RC window is FOR, so this guard stands aside for
 * the duration and re-arms automatically once pre-mode is exited. The pending
 * majors are still printed (informationally) so the RC curator can eyeball them.
 *
 * ESCAPE HATCH: outside pre-mode, when a major release is genuinely intended,
 * gate this check off in CI with the `allow-major` PR label (see
 * `.github/workflows/pr-automation.yml`).
 *
 * The script intentionally has zero third-party dependencies so it can run in
 * minimal CI environments before `pnpm install`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const changesetDir = resolve(repoRoot, '.changeset');

/**
 * Extract the YAML frontmatter block (between the first two `---` fences) and
 * return the list of `major`-bumped package names declared in it.
 *
 * A frontmatter line looks like:  "@objectstack/spec": major
 * (single or double quotes, any surrounding whitespace).
 *
 * @param {string} text
 * @returns {string[]}
 */
function majorPackagesIn(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return [];
  const majors = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') break; // end of frontmatter
    // "<name>": <bump>   |   '<name>': <bump>   |   <name>: <bump>
    const m = /^\s*["']?([^"':]+)["']?\s*:\s*([A-Za-z]+)\s*$/.exec(line);
    if (m && m[2].toLowerCase() === 'major') majors.push(m[1].trim());
  }
  return majors;
}

let entries;
try {
  entries = readdirSync(changesetDir);
} catch {
  console.log('No .changeset directory found — nothing to check.');
  process.exit(0);
}

const offenders = [];
for (const name of entries) {
  if (!name.endsWith('.md') || name === 'README.md') continue;
  const file = join(changesetDir, name);
  const majors = majorPackagesIn(readFileSync(file, 'utf8'));
  if (majors.length) offenders.push({ file: `.changeset/${name}`, majors });
}

if (offenders.length === 0) {
  console.log('✓ No `major` bumps in pending changesets.');
  process.exit(0);
}

// RC exemption: in Changesets pre-release mode a `major` only yields a
// `X.0.0-<tag>.N` pre-release — the intended product of an RC window — and
// nothing final ships until `changeset pre exit`. Surface the pending majors
// for the RC curator, but do not fail. The guard re-arms once pre-mode exits.
try {
  const pre = JSON.parse(readFileSync(join(changesetDir, 'pre.json'), 'utf8'));
  if (pre?.mode === 'pre') {
    console.log(
      `✓ Changesets is in pre-release mode (tag: ${pre.tag ?? 'unknown'}) — ` +
        '`major` bumps are the expected product of an RC window; skipping the no-major guard.',
    );
    for (const { file, majors } of offenders) {
      console.log(`::notice file=${file}::pending major in ${file}: ${majors.join(', ')}`);
    }
    process.exit(0);
  }
} catch {
  // No readable `.changeset/pre.json` → not in pre-mode → fall through to the guard.
}

console.error('⛔ Changeset(s) declare a `major` bump.\n');
for (const { file, majors } of offenders) {
  console.error(`   ${file}`);
  for (const pkg of majors) console.error(`     - ${pkg}: major`);
}
console.error(
  '\nEvery publishable package is in the Changesets `fixed` (lockstep) group, so a single\n' +
    '`major` promotes the ENTIRE monorepo to a new major version. During the launch window\n' +
    'ship breaking changes as `minor` instead (they do not burn a major version number).\n' +
    '\n' +
    'If a whole-stack major release is genuinely intended, add the `allow-major` label to\n' +
    'the PR to skip this check.',
);
process.exit(1);
