#!/usr/bin/env node
// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.
//
// Guards the single source of truth for request authorization resolution
// (`resolveAuthzContext`, @objectstack/core). Prevents the two regressions that
// motivated the extraction:
//   1. A NEW request-context resolver copy. The original bug: the REST server
//      kept its own resolver that drifted from the dispatcher's and silently
//      dropped `sys_user_role`, so custom-role grants didn't apply over REST.
//   2. An entry point that stops delegating to the shared resolver.
//
// Heuristic for (1): a non-test source file that references BOTH `sys_user_role`
// and `sys_user_permission_set` is doing request-context role+permission
// aggregation — the resolver's job — and must be the canonical module (or an
// explicitly allow-listed non-resolver, e.g. seed definitions).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CANONICAL = 'packages/core/src/security/resolve-authz-context.ts';

// Files allowed to reference both role tables WITHOUT being a request resolver.
const ALLOW = new Set([
  CANONICAL,
  // Seed/definition of the default permission sets + role bindings — not a resolver.
  'packages/plugins/plugin-security/src/objects/default-permission-sets.ts',
]);

// Entry points that MUST delegate to the shared resolver (never re-inline it).
const DELEGATORS = [
  'packages/rest/src/rest-server.ts',
  'packages/runtime/src/security/resolve-execution-context.ts',
];

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (e === 'node_modules' || e === 'dist' || e === '__tests__') continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (e.endsWith('.ts') && !e.endsWith('.test.ts') && !e.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const errors = [];

// (1) No duplicate request-context resolver.
for (const abs of walk(join(ROOT, 'packages'))) {
  const rel = abs.slice(ROOT.length + 1);
  if (ALLOW.has(rel)) continue;
  const src = readFileSync(abs, 'utf8');
  if (src.includes('sys_user_role') && src.includes('sys_user_permission_set')) {
    errors.push(
      `Possible duplicate authorization resolver: ${rel}\n` +
      `  references BOTH sys_user_role and sys_user_permission_set. Request-context\n` +
      `  role/permission resolution must live ONLY in ${CANONICAL} (resolveAuthzContext),\n` +
      `  shared by every transport. If this file needs both for a non-resolution reason,\n` +
      `  add it to ALLOW in scripts/check-single-authz-resolver.mjs.`,
    );
  }
}

// (2) Entry points still delegate to the shared resolver.
for (const rel of DELEGATORS) {
  let src;
  try { src = readFileSync(join(ROOT, rel), 'utf8'); } catch { errors.push(`Delegator missing: ${rel}`); continue; }
  if (!src.includes('resolveAuthzContext')) {
    errors.push(
      `${rel} no longer delegates to resolveAuthzContext.\n` +
      `  Every HTTP entry point must resolve authorization via the shared\n` +
      `  @objectstack/core resolver — do not re-inline session/role/permission reads.`,
    );
  }
}

if (errors.length) {
  console.error('✗ check:authz-resolver failed:\n\n' + errors.join('\n\n') + '\n');
  process.exit(1);
}
console.log('✓ check:authz-resolver: single shared authorization resolver intact; both entry points delegate.');
