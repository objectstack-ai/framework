#!/usr/bin/env node
// objectui-range — summarize the frontend (objectui) delta bundled between two
// framework revisions, ready to paste into a release page's Console section.
//
// The platform is one version-locked train and the Console UI is frozen into
// @objectstack/console at the objectui commit pinned in .objectui-sha. To learn
// "what did the frontend change between platform version A and B", you diff the
// pinned SHA at two framework revisions and read objectui's log for that range.
// This script does exactly that — the aggregation layer described in
// docs/releases-maintenance.md.
//
// Usage:
//   node scripts/objectui-range.mjs <old-rev> [new-rev]
//       old-rev / new-rev are FRAMEWORK git refs (tags, branches, SHAs).
//       new-rev defaults to the working-tree .objectui-sha (the current pin).
//   node scripts/objectui-range.mjs --from <objectui-sha> --to <objectui-sha>
//       skip the framework lookup; use explicit objectui SHAs.
//   … --json     emit structured JSON instead of markdown
//   … --all      include every conventional-commit type (default: feat + fix)
//
// Env:
//   OBJECTUI_ROOT=/path/to/objectui   (default: ../objectui, like bump-objectui.sh)
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const FRAMEWORK_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OBJECTUI_ROOT =
  process.env.OBJECTUI_ROOT || join(FRAMEWORK_ROOT, '..', 'objectui');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};
const positional = argv.filter(
  (a, i) => !a.startsWith('--') && argv[i - 1] !== '--from' && argv[i - 1] !== '--to',
);

const JSON_OUT = has('--json');
const ALL_TYPES = has('--all');

if (has('-h') || has('--help')) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n')
    .filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  process.exit(0);
}

function die(msg) {
  console.error(`✗ objectui-range: ${msg}`);
  process.exit(1);
}

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

// Resolve the objectui SHA pinned at a given framework rev (or the working tree).
function pinAt(rev) {
  if (rev === undefined) {
    const p = join(FRAMEWORK_ROOT, '.objectui-sha');
    if (!existsSync(p)) die('.objectui-sha not found in the working tree');
    return readFileSync(p, 'utf8').trim();
  }
  try {
    return git(FRAMEWORK_ROOT, ['show', `${rev}:.objectui-sha`]).trim();
  } catch {
    return die(`cannot read .objectui-sha at framework rev '${rev}'`);
  }
}

let fromSha = val('--from');
let toSha = val('--to');
if (!fromSha || !toSha) {
  if (positional.length < 1) {
    die('need <old-rev> [new-rev], or --from <sha> --to <sha>. See --help/header.');
  }
  fromSha = pinAt(positional[0]);
  toSha = pinAt(positional[1]); // undefined → working-tree pin
}

if (!existsSync(join(OBJECTUI_ROOT, '.git'))) {
  die(
    `no objectui checkout at ${OBJECTUI_ROOT}.\n` +
      `  Clone it as a sibling, or set OBJECTUI_ROOT=/path/to/objectui.\n` +
      `  Range to inspect once available: ${fromSha.slice(0, 12)}..${toSha.slice(0, 12)}`,
  );
}

if (fromSha === toSha) {
  console.log(`objectui unchanged (${fromSha.slice(0, 12)}) — no frontend delta in this range.`);
  process.exit(0);
}

let rawLog;
try {
  rawLog = git(OBJECTUI_ROOT, [
    'log', '--no-merges', '--format=%H%x09%s', `${fromSha}..${toSha}`,
  ]);
} catch {
  die(
    `cannot walk ${fromSha.slice(0, 12)}..${toSha.slice(0, 12)} in ${OBJECTUI_ROOT}.\n` +
      `  Fetch it: git -C ${OBJECTUI_ROOT} fetch --all`,
  );
}

const CC = /^(feat|fix|refactor|perf|docs|test|chore|build|ci|style|revert)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
const KEEP = ALL_TYPES ? null : new Set(['feat', 'fix']);

const commits = [];
for (const line of rawLog.split('\n').filter(Boolean)) {
  const tab = line.indexOf('\t');
  const sha = line.slice(0, tab);
  const subject = line.slice(tab + 1);
  const m = subject.match(CC);
  const type = m ? m[1] : 'other';
  const scope = m ? m[2] || '' : '';
  const desc = m ? m[4] : subject;
  if (KEEP && !KEEP.has(type)) continue;
  commits.push({ sha, type, scope, desc, subject });
}

// Top touched areas (by scope) across the kept commits — the "big picture" line.
const areaCounts = {};
for (const c of commits) if (c.scope) areaCounts[c.scope] = (areaCounts[c.scope] || 0) + 1;
const topAreas = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

const byType = { feat: [], fix: [] };
for (const c of commits) (byType[c.type] || (byType[c.type] = [])).push(c);

if (JSON_OUT) {
  console.log(JSON.stringify(
    { from: fromSha, to: toSha, count: commits.length, topAreas, commits }, null, 2,
  ));
  process.exit(0);
}

const line = (c) => `- ${c.scope ? `**${c.scope}** — ` : ''}${c.desc}`;
const out = [];
out.push(`<!-- objectui ${fromSha.slice(0, 12)}..${toSha.slice(0, 12)} — ${commits.length} commit(s) -->`);
if (topAreas.length) {
  out.push('', `_Largest areas: ${topAreas.map(([a, n]) => `${a} (${n})`).join(', ')}_`);
}
if (byType.feat?.length) {
  out.push('', '### Features', ...byType.feat.map(line));
}
if (byType.fix?.length) {
  out.push('', '### Fixes', ...byType.fix.map(line));
}
const extra = Object.keys(byType).filter((t) => t !== 'feat' && t !== 'fix' && byType[t].length);
for (const t of extra) out.push('', `### ${t}`, ...byType[t].map(line));
if (commits.length === 0) out.push('', '_No feat/fix commits in range (try --all)._');

console.log(out.join('\n'));
