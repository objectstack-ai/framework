#!/usr/bin/env node
// check-role-word — ADR-0090 D3 vocabulary ratchet for hand-written docs.
//
// D3 makes "role" a reserved-forbidden word (capability = permission_set,
// distribution = position, hierarchy = business_unit). The publish-time lint
// (`security-role-word`, packages/lint) enforces this for AUTHORED METADATA;
// nothing enforced it for the repo's own documentation — which is how the
// pre-D3 copy in book.zod.ts ("role-gated") and content/docs survived the
// P1 rename wave (#2697 was identifier-driven).
//
// This is a RATCHET, not a ban-with-exceptions: existing occurrences are
// frozen in scripts/role-word-baseline.json (many are legitimate — the
// better-auth boundary, ARIA `role=` in samples, educational "formerly
// roles" mentions — and untangling them file-by-file is incremental work).
// The check fails when:
//   • a file NOT in the baseline contains the word, or
//   • a baselined file's count INCREASES, or
//   • a baselined file's count DECREASED / file vanished (improvement!) —
//     run with --update to ratchet the baseline down and commit it.
//
//   node scripts/check-role-word.mjs [--update]
//
// Scope: content/docs (hand-written; references/ is generated from spec and
// excluded — the spec source is the fix site there) and skills/. File and
// directory NAMES count too (they become URLs).
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['content/docs', 'skills'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'references']);
const EXTENSIONS = new Set(['.mdx', '.md']);
const BASELINE_PATH = 'scripts/role-word-baseline.json';
const WORD = /\brole(?:s)?\b/gi;

const update = process.argv.includes('--update');

function walk(dir, out) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if ([...EXTENSIONS].some((x) => e.endsWith(x))) out.push(p);
  }
}

function countMatches(text) {
  const m = text.match(WORD);
  return m ? m.length : 0;
}

const files = [];
for (const root of ROOTS) if (existsSync(root)) walk(root, files);

const current = {};
for (const f of files.sort()) {
  const rel = relative('.', f).replace(/\\/g, '/');
  // File/dir names are URLs — a `role-*` slug is UI copy (counts once).
  const nameHits = countMatches(rel);
  const bodyHits = countMatches(readFileSync(f, 'utf8'));
  const total = nameHits + bodyHits;
  if (total > 0) current[rel] = total;
}

if (update) {
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n');
  console.log(`role-word baseline updated: ${Object.keys(current).length} file(s).`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : {};

const errors = [];
for (const [file, count] of Object.entries(current)) {
  const allowed = baseline[file];
  if (allowed === undefined) {
    errors.push(`${file}: NEW use of the reserved word "role" (${count} occurrence(s)). ` +
      `ADR-0090 D3: use permission_set / position / business_unit — or, for a genuine ` +
      `boundary (better-auth, ARIA, quoted history), add it to ${BASELINE_PATH} with --update.`);
  } else if (count > allowed) {
    errors.push(`${file}: role-word count grew ${allowed} → ${count}. New occurrences are banned (ADR-0090 D3).`);
  }
}
for (const [file, allowed] of Object.entries(baseline)) {
  const now = current[file];
  if (now === undefined) {
    errors.push(`${file}: baselined file is clean/gone (was ${allowed}) — ratchet DOWN: run \`node scripts/check-role-word.mjs --update\` and commit the baseline.`);
  } else if (now < allowed) {
    errors.push(`${file}: role-word count improved ${allowed} → ${now} — ratchet DOWN: run \`node scripts/check-role-word.mjs --update\` and commit the baseline.`);
  }
}

if (errors.length) {
  console.error(`check-role-word: ${errors.length} problem(s)\n`);
  for (const e of errors) console.error('  • ' + e);
  process.exit(1);
}
console.log(`check-role-word: OK (${Object.keys(current).length} baselined file(s), no new occurrences).`);
