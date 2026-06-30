// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Spec ↔ frontend conformance report (ADR-0081 follow-up). Confirms the
// objectui components ACTUALLY implement the props the spec protocol declares
// for each curated react block. The spec is the protocol; the frontend must
// conform. This surfaces (and can ratchet) the divergence.
//
//   - spec-only  : the spec schema declares a prop the component does NOT expose
//                  as a registry input → frontend hasn't implemented the protocol.
//   - frontend-only: the component exposes an input the spec does NOT declare →
//                  undocumented extension (or the spec is behind).
//
// The frontend side is the objectui registry-inputs manifest (sdui.manifest.json,
// produced from the live registry — see objectui scripts/dump-public-manifest.mjs).
// Provide it with MANIFEST=/path/to/sdui.manifest.json. Without it, the check
// reports "manifest unavailable" and exits 0 (same manifest-optional posture as
// the html-tier gate).
//
// Run: MANIFEST=… pnpm --filter @objectstack/spec check:react-conformance

process.env.OS_EAGER_SCHEMAS = '1';

import fs from 'fs';
import { z } from 'zod';
import { REACT_BLOCKS } from '../src/ui/react-blocks';

const MANIFEST = process.env.MANIFEST;
const FAIL_ON_DIVERGENCE = process.argv.includes('--strict');

function specProps(schema: any): string[] {
  try {
    let js: any = z.toJSONSchema(schema, { unrepresentable: 'any' } as any);
    if (js?.$ref && js?.$defs) js = js.$defs[String(js.$ref).split('/').pop()!] ?? js;
    return Object.keys(js?.properties ?? {}).filter((k) => !['aria', 'type', 'id', 'className', 'style'].includes(k));
  } catch {
    return [];
  }
}

function manifestInputs(manifest: any, schemaType: string): string[] | null {
  const comps = manifest?.components ?? manifest ?? {};
  // keys may be bare ('object-form') or namespaced ('plugin-form:object-form').
  const entry =
    comps[schemaType] ??
    Object.entries(comps).find(([k]) => k === schemaType || k.endsWith(`:${schemaType}`))?.[1];
  if (!entry) return null;
  const inputs = (entry as any).inputs ?? [];
  return inputs.map((i: any) => i?.name).filter(Boolean);
}

if (!MANIFEST || !fs.existsSync(MANIFEST)) {
  console.log('⚠ react-blocks conformance: manifest unavailable (set MANIFEST=…) — skipping.');
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
let totalSpecOnly = 0;
let totalMissingComp = 0;
const overlay = (b: (typeof REACT_BLOCKS)[number]) => new Set(b.interactions.map((i) => i.name));

console.log('# Spec ↔ frontend conformance (react blocks)\n');
for (const b of REACT_BLOCKS) {
  if (!b.schema) continue;
  const spec = new Set(specProps(b.schema));
  const inputs = manifestInputs(manifest, b.schemaType);
  if (inputs === null) {
    console.log(`✗ <${b.tag}> (${b.schemaType}): NO component in the manifest — not registered or not public.`);
    totalMissingComp++;
    continue;
  }
  const inputSet = new Set(inputs);
  const ov = overlay(b);
  const specOnly = [...spec].filter((p) => !inputSet.has(p) && !ov.has(p));
  const frontendOnly = [...inputSet].filter((p) => !spec.has(p) && !ov.has(p));
  const matched = [...spec].filter((p) => inputSet.has(p));
  totalSpecOnly += specOnly.length;
  const status = specOnly.length === 0 ? '✓' : '⚠';
  console.log(`${status} <${b.tag}> (${b.schemaType}): ${matched.length} matched, ${specOnly.length} spec-only, ${frontendOnly.length} frontend-only`);
  if (specOnly.length) console.log(`    spec declares but component lacks: ${specOnly.join(', ')}`);
  if (frontendOnly.length) console.log(`    component exposes but spec lacks: ${frontendOnly.join(', ')}`);
}
console.log(`\nSummary: ${totalSpecOnly} spec-only divergences, ${totalMissingComp} blocks missing from the frontend.`);
if (FAIL_ON_DIVERGENCE && (totalSpecOnly > 0 || totalMissingComp > 0)) {
  console.error('Conformance check failed (--strict).');
  process.exit(1);
}
