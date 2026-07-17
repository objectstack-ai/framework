#!/usr/bin/env node
// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.
//
// check-nul-bytes -- rejects raw NUL (0x00) bytes in tracked JS/TS sources.
//
// A single raw NUL makes grep/ripgrep classify the WHOLE file as binary and
// silently return zero matches. `grep -n saveMetaItem
// packages/metadata-protocol/src/protocol.ts` reported nothing despite 16 real
// hits -- a core protocol file invisible to code search and to every grep-based
// lint, with no error to say so. The intent in each case was a composite-key
// separator, which must be written as the escape sequence \u0000; that string
// is byte-identical at runtime, so nothing else changes.
//
// Review does not catch this and neither did anything else: git decides
// binary-ness from the first 8000 bytes only, and protocol.ts carried its NUL
// at offset 147230, so it kept diffing as ordinary text. That blind spot is how
// six separate files accumulated the same defect before #3127 fixed them. This
// guard is what keeps them from coming back.
//
//   node scripts/check-nul-bytes.mjs
//
// Scope: tracked sources only (git ls-files). Generated and vendored output is
// excluded -- a NUL in a build artifact is that toolchain's business, not ours.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The escape sequence authors should write instead, and the in-repo precedent.
// Written as an escape, never as the byte -- this file is itself in scope, so a
// literal NUL here would make the guard fail on itself.
const ESCAPE = '\\u0000';
const CONVENTION = 'packages/rest/src/rest-server.ts:1065';

// JS/TS source only. This is hand-authored text, where a raw NUL is always a
// mistake -- data fixtures (.json, .snap) can legitimately carry one.
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.cts', '.mts'];

// Belt-and-braces: git already ignores these, so nothing matches today. Kept so
// a future vendored or committed artifact directory cannot quietly turn this red.
const EXCLUDED = /(^|\/)(node_modules|dist|build|\.next|\.turbo)\//;

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

// -z: NUL-delimited output, the one context where the byte is load-bearing
// rather than a bug. Note the escape form -- this file must pass its own check.
const files = execFileSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
  .split('\u0000')
  .filter(Boolean)
  .filter((f) => EXTENSIONS.some((ext) => f.endsWith(ext)))
  .filter((f) => !EXCLUDED.test(f));

// Byte offset -> line:column, so the author can jump straight to a byte their
// editor renders as nothing and grep refuses to look for.
function locate(buf, offset) {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset; i++) {
    if (buf[i] === 0x0a) {
      line++;
      lineStart = i + 1;
    }
  }
  const column = buf.subarray(lineStart, offset).toString('utf8').length + 1;
  return { line, column };
}

const offenders = [];
for (const file of files) {
  const buf = readFileSync(join(root, file));
  const offsets = [];
  for (let i = buf.indexOf(0); i !== -1; i = buf.indexOf(0, i + 1)) offsets.push(i);
  if (offsets.length === 0) continue;
  const { line, column } = locate(buf, offsets[0]);
  offenders.push({ file, line, column, offset: offsets[0], count: offsets.length });
}

if (offenders.length === 0) {
  console.log(`check-nul-bytes: OK (${files.length} tracked source file(s), no raw NUL bytes).`);
  process.exit(0);
}

const plural = offenders.length === 1 ? 'file contains' : 'files contain';
console.error(`check-nul-bytes: ${offenders.length} ${plural} a raw NUL byte (0x00)\n`);
for (const o of offenders) {
  const times = o.count === 1 ? '1 occurrence' : `${o.count} occurrences`;
  console.error(`  • ${o.file}:${o.line}:${o.column} -- ${times}, first at byte offset ${o.offset}`);
}
console.error(`
A raw NUL makes grep/ripgrep treat the entire file as binary and silently return
ZERO matches, so the file drops out of code search and out of every grep-based
lint. git will not warn you: it only scans the first 8000 bytes to decide
binary-ness, so a NUL past that offset keeps diffing as ordinary text.

Write the escape sequence ${ESCAPE} instead of the byte. The resulting string is
byte-identical at runtime, so behaviour does not change. Existing convention --
${CONVENTION}:

    const key = environmentId ?? '${ESCAPE}default';

Prefer ${ESCAPE} over \\0, which becomes a legacy octal escape error if it is
ever followed by a digit.`);
process.exit(1);
