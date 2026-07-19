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
// `ctx.session.tenantId` is a DEPRECATED alias that still works but teaches the
// wrong name -- and TSDoc `@deprecated` only nudges an author whose editor
// surfaces it. Nothing stopped our own reference apps (examples/, apps/), which
// authors and AIs copy from, from re-introducing `session.tenantId`.
//
// This is a hard-fail guard, not a ratchet: the authoring surfaces carry ZERO
// occurrences today, so any match is a NEW one and fails. It is deliberately
// NARROW:
//   • Scope is author-facing reference code only (examples/, apps/). Internal
//     framework packages legitimately read `session.tenantId` (the engine's own
//     `buildSession`, the record-change trigger) -- that is the driver-layer
//     alias, a non-goal of #3280, and must not be flagged.
//   • skills/ and content/docs/ are EXCLUDED: they deliberately show the
//     deprecated form when TEACHING the deprecation ("deprecated alias").
//   • The pattern matches only the `session.tenantId` token, never
//     `execCtx.tenantId` / `opts.tenantId` / `DriverOptions.tenantId`, which are
//     the generic driver-layer tenancy knob (explicitly out of scope).
//
// Escape hatch for a genuine driver-layer `session.tenantId` in an example:
// add `os-allow-tenant-id` in a comment on the same line.
//
//   node scripts/check-org-identifier.mjs
//
// Scope: tracked sources under examples/ and apps/ only (git ls-files).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['examples', 'apps'];
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.cts', '.mts'];
const EXCLUDED = /(^|\/)(node_modules|dist|build|\.next|\.turbo)\//;

// `ctx.session.tenantId`, `session?.tenantId`, `this.session . tenantId`, … —
// the `session` receiver immediately before `.tenantId`. Anchored on the
// `session` word so `execCtx.tenantId` / `opts.tenantId` never match.
const PATTERN = /\bsession\s*\??\.\s*tenantId\b/;
const ALLOW_MARKER = 'os-allow-tenant-id';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

// Newline-delimited on purpose (not `-z`): tracked paths under examples/ and
// apps/ never contain a newline, and avoiding the NUL delimiter keeps this very
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
  .filter((f) => !EXCLUDED.test(f));

const offenders = [];
for (const file of files) {
  const text = readFileSync(join(root, file), 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!PATTERN.test(line)) continue;
    if (line.includes(ALLOW_MARKER)) continue;
    offenders.push({ file, line: i + 1, text: line.trim() });
  }
}

if (offenders.length === 0) {
  console.log(
    `check-org-identifier: OK (${files.length} author-facing source file(s), no deprecated session.tenantId).`,
  );
  process.exit(0);
}

const plural = offenders.length === 1 ? 'occurrence' : 'occurrences';
console.error(
  `check-org-identifier: ${offenders.length} deprecated \`session.tenantId\` ${plural} in author-facing code\n`,
);
for (const o of offenders) {
  console.error(`  • ${o.file}:${o.line}  ${o.text}`);
}
console.error(`
\`session.tenantId\` is a DEPRECATED alias (#3280). In a hook or action body read
the caller's active org under the blessed name instead:

    const org = ctx.user?.organizationId ?? ctx.session?.organizationId;

It carries the identical value and matches the \`organization_id\` column and
\`current_user.organizationId\` in RLS. For a genuine driver-layer use, add an
\`${ALLOW_MARKER}\` comment on the line.`);
process.exit(1);
