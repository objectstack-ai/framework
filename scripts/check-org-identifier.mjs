#!/usr/bin/env node
// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.
//
// check-org-identifier -- keeps author-facing reference code on the blessed
// org name in hook/action bodies.
//
// #3280 made `organizationId` the blessed developer-facing name for the
// caller's active org across the JS authoring surface: a hook or action body
// reads `ctx.user.organizationId` / `ctx.session.organizationId`, matching the
// `organization_id` column and `current_user.organizationId` in RLS. The old
// `ctx.session.tenantId` was a deprecated alias; #3290 REMOVED it from the
// hook/action `ctx.session` surface entirely (v11 major), so any `session.tenantId`
// read in an authoring body now resolves to `undefined` and is simply a bug.
//
// This is a hard-fail guard, not a ratchet: the scanned surfaces carry ZERO
// occurrences today, so any match is a NEW one and fails. It is deliberately
// NARROW:
//   • Scope is author-facing reference code: examples/, apps/, AND packages/
//     (#3290). The framework's own hook/action surface no longer emits or reads
//     `session.tenantId` (engine `buildSession`, the record-change trigger, and
//     the ObjectQL audit-stamp plugin were migrated to `organizationId`), so
//     packages/ is now held to the same bar as reference apps — an author or AI
//     copying a package example body will not find the removed name.
//   • The generic DRIVER-LAYER tenancy knob is untouched and never matched: the
//     pattern anchors on the `session` receiver, so `execCtx.tenantId` /
//     `opts.tenantId` / `DriverOptions.tenantId` (a configurable isolation
//     column, legitimately an *environment* id in database-per-tenant kernels)
//     do not trip it. For the rare genuine driver-layer `session.tenantId`, add
//     an `os-allow-tenant-id` comment on the same line.
//   • Test/spec files are EXCLUDED: they legitimately reference the removed
//     token to assert its ABSENCE (`expect(session.tenantId).toBeUndefined()`),
//     and are not reference bodies an author copies a hook from.
//   • Comment lines are SKIPPED (JSDoc `*`, `//`, `/*`, and trailing `// …`): a
//     migration note that NAMES the removed alias to explain its removal is
//     documentation, not an executable read. Only code is checked.
//   • skills/ and content/docs/ are EXCLUDED: prose there may still name the
//     removed alias when documenting the migration.
//
//   node scripts/check-org-identifier.mjs
//
// Scope: tracked sources under examples/, apps/, and packages/ (git ls-files).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['examples', 'apps', 'packages'];
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.cts', '.mts'];
const EXCLUDED = /(^|\/)(node_modules|dist|build|\.next|\.turbo)\//;
// Tests assert the alias is GONE, so they reference the token on purpose.
const TEST_FILE = /(\.(test|spec)\.[cm]?[jt]sx?$)|((^|\/)__tests__\/)/;

// `ctx.session.tenantId`, `session?.tenantId`, `this.session . tenantId`, … —
// the `session` receiver immediately before `.tenantId`. Anchored on the
// `session` word so `execCtx.tenantId` / `opts.tenantId` never match.
const PATTERN = /\bsession\s*\??\.\s*tenantId\b/;
const ALLOW_MARKER = 'os-allow-tenant-id';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

// Newline-delimited on purpose (not `-z`): tracked paths under these roots
// never contain a newline, and avoiding the NUL delimiter keeps this very
// script free of any raw NUL byte (which would make it invisible to grep — the
// exact #3127 failure mode this repo already guards with check:nul-bytes).
const files = execFileSync('git', ['ls-files', '--', ...ROOTS], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
  .split('\n')
  .filter(Boolean)
  .filter((f) => EXTENSIONS.some((ext) => f.endsWith(ext)))
  .filter((f) => !EXCLUDED.test(f))
  .filter((f) => !TEST_FILE.test(f));

const offenders = [];
for (const file of files) {
  const text = readFileSync(join(root, file), 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(ALLOW_MARKER)) continue;
    // Skip comment lines — a migration note that names the removed alias is
    // documentation, not an executable read (JSDoc `*`, line/block `//`,`/*`).
    const trimmed = line.trimStart();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    // Drop any trailing line-comment so `foo(); // …session.tenantId…` is clean.
    const code = line.replace(/\/\/.*$/, '');
    if (!PATTERN.test(code)) continue;
    offenders.push({ file, line: i + 1, text: line.trim() });
  }
}

if (offenders.length === 0) {
  console.log(
    `check-org-identifier: OK (${files.length} author-facing source file(s), no removed session.tenantId alias).`,
  );
  process.exit(0);
}

const plural = offenders.length === 1 ? 'occurrence' : 'occurrences';
console.error(
  `check-org-identifier: ${offenders.length} removed \`session.tenantId\` ${plural} in author-facing code\n`,
);
for (const o of offenders) {
  console.error(`  • ${o.file}:${o.line}  ${o.text}`);
}
console.error(`
\`session.tenantId\` was REMOVED from the hook/action ctx.session surface (#3290);
it no longer carries a value. In a hook or action body read the caller's active
org under the blessed name instead:

    const org = ctx.user?.organizationId ?? ctx.session?.organizationId;

It matches the \`organization_id\` column and \`current_user.organizationId\` in
RLS. For a genuine driver-layer use (a configurable isolation column, not the
caller's org), add an \`${ALLOW_MARKER}\` comment on the line.`);
process.exit(1);
