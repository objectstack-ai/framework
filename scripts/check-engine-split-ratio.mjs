#!/usr/bin/env node
/**
 * ADR-0076 D7 trigger metric (#2462): cross-package commit ratio of the
 * ObjectQL engine core (`engine.ts` / `registry.ts`).
 *
 * The engine repo-split (D7) is trigger-gated: it may only happen once the
 * share of engine-core commits that ALSO touch files outside
 * `packages/objectql/` falls to a low, stable level (it was ~88% when the
 * ADR was written — i.e. the engine still co-evolves with the rest of the
 * monorepo and is NOT separable). This script computes that ratio from git
 * history so CI can track it over time.
 *
 * Run:  node scripts/check-engine-split-ratio.mjs [--days N] [--threshold PCT]
 *
 *   --days N         Look-back window in days (default 90).
 *   --threshold PCT  Optional gate: exit 1 if the ratio is ABOVE the given
 *                    percentage. By default the script is REPORT-ONLY (always
 *                    exits 0) — the split threshold is an open question
 *                    (ADR-0076 OQ#5) and is set deliberately, not by default.
 *
 * Output: a human-readable summary on stdout; when $GITHUB_STEP_SUMMARY is
 * set, a markdown section is appended for the Actions run summary.
 *
 * Requires full git history (in CI: actions/checkout with fetch-depth: 0).
 * Zero third-party dependencies.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const ENGINE_CORE = ['packages/objectql/src/engine.ts', 'packages/objectql/src/registry.ts'];
const ENGINE_PACKAGE_PREFIX = 'packages/objectql/';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] !== undefined) return process.argv[i + 1];
  return fallback;
}

const days = Number(arg('days', '90'));
const thresholdRaw = arg('threshold', '');
const threshold = thresholdRaw === '' ? null : Number(thresholdRaw);
if (!Number.isFinite(days) || days <= 0) {
  console.error(`Invalid --days value: ${arg('days', '90')}`);
  process.exit(2);
}
if (thresholdRaw !== '' && (!Number.isFinite(threshold) || threshold < 0 || threshold > 100)) {
  console.error(`Invalid --threshold value: ${thresholdRaw} (expected 0-100)`);
  process.exit(2);
}

function git(...args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

// Commits in the window that touched the engine core.
const shas = git(
  'log', `--since=${days} days ago`, '--format=%H', '--', ...ENGINE_CORE,
).split('\n').filter(Boolean);

let crossPackage = 0;
for (const sha of shas) {
  const files = git('show', '--name-only', '--format=', sha).split('\n').filter(Boolean);
  if (files.some((f) => !f.startsWith(ENGINE_PACKAGE_PREFIX))) crossPackage += 1;
}

const total = shas.length;
const ratio = total === 0 ? 0 : (crossPackage / total) * 100;
const ratioStr = ratio.toFixed(1);

const lines = [
  `ADR-0076 D7 trigger metric — engine cross-package commit ratio`,
  `  window:               last ${days} days`,
  `  engine-core commits:  ${total}  (${ENGINE_CORE.join(', ')})`,
  `  also cross-package:   ${crossPackage}`,
  `  ratio:                ${total === 0 ? 'n/a (no engine-core commits in window)' : `${ratioStr}%`}`,
  ``,
  `Reference: ~88% at ADR time (2026-06) — the engine repo-split (D7) stays`,
  `deferred until this ratio is low and stable (threshold TBD, ADR-0076 OQ#5).`,
];
console.log(lines.join('\n'));

if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [
    `### ADR-0076 D7 trigger metric — engine cross-package commit ratio`,
    ``,
    `| Window | Engine-core commits | Cross-package | Ratio |`,
    `|---|---|---|---|`,
    `| last ${days} days | ${total} | ${crossPackage} | ${total === 0 ? 'n/a' : `${ratioStr}%`} |`,
    ``,
    `Reference: ~88% at ADR time. D7 (engine repo-split) stays deferred until this is low and stable (OQ#5).`,
    ``,
  ].join('\n');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}

if (threshold !== null && total > 0 && ratio > threshold) {
  console.error(`\nRatio ${ratioStr}% exceeds the configured threshold of ${threshold}% — engine is not separable.`);
  process.exit(1);
}
