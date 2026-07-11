#!/usr/bin/env node
// check-release-notes — guard against the "docs stopped at vN while the
// platform shipped vN+k" drift (the gap that let v10–v14 ship with no curated
// release page while @objectstack/spec was already at 14.x).
//
// The platform is a single version-locked train (changesets `fixed` group), so
// the @objectstack/spec MAJOR is the platform version. Every RELEASED major
// must have a curated, developer-facing release page at
// content/docs/releases/v<major>.mdx, and that page must be wired into the
// section's meta.json so it is actually navigable.
//
// Released majors are read from the spec package CHANGELOG (the changesets
// source of truth). Curated pages only began at v9, and v10/v11 were never
// backfilled — those are the documented, intentional exceptions below. Anything
// else missing is a real gap and fails the build.
//
//   node scripts/check-release-notes.mjs
//
// When a new major ships: write content/docs/releases/v<major>.mdx (lead with
// breaking changes + migration; fold minors into a "What's new in N.x" section)
// and add it to content/docs/releases/meta.json.
import { readFileSync, existsSync } from 'node:fs';

const SPEC_CHANGELOG = 'packages/spec/CHANGELOG.md';
const RELEASES_DIR = 'content/docs/releases';
const META_PATH = `${RELEASES_DIR}/meta.json`;

// Curated release pages started at v9; v10/v11 were never backfilled (see
// content/docs/releases/index.mdx). Everything from v12 on must have a page.
const FLOOR_MAJOR = 9;
const KNOWN_MISSING = new Set([10, 11]);

function releasedMajors() {
  const text = readFileSync(SPEC_CHANGELOG, 'utf8');
  const majors = new Set();
  for (const m of text.matchAll(/^##\s+(\d+)\.\d+\.\d+/gm)) {
    majors.add(Number.parseInt(m[1], 10));
  }
  return [...majors].sort((a, b) => a - b);
}

const meta = JSON.parse(readFileSync(META_PATH, 'utf8'));
const metaPages = new Set(meta.pages || []);

const problems = [];
for (const major of releasedMajors()) {
  if (major < FLOOR_MAJOR || KNOWN_MISSING.has(major)) continue;
  const slug = `v${major}`;
  if (!existsSync(`${RELEASES_DIR}/${slug}.mdx`)) {
    problems.push(
      `${RELEASES_DIR}/${slug}.mdx is missing — @objectstack/spec shipped a ${major}.x ` +
        `release but there is no curated release page. Write it (lead with breaking ` +
        `changes + migration), then add "${slug}" to ${META_PATH}.`,
    );
  } else if (!metaPages.has(slug)) {
    problems.push(
      `${slug}.mdx exists but is not listed in ${META_PATH} "pages" — the page is ` +
        `unreachable in the docs nav. Add "${slug}" to the pages array.`,
    );
  }
}

if (problems.length > 0) {
  console.error(`check-release-notes: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(1);
}

console.log('check-release-notes: OK — every released major has a curated, navigable release page.');
