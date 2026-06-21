// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * build-api-surface.ts — snapshot the PUBLIC export surface of @objectstack/spec.
 *
 * For a metadata-driven platform the spec package IS the third-party API. A
 * silently removed or renamed export breaks every downstream consumer pinned to
 * a published release the moment they upgrade — the #2023 class of break, which
 * no in-repo consumer can catch because they all co-evolve with the spec.
 *
 * This records, per public entry point (`.`, `./ui`, `./data`, …), every
 * exported `name (kind)` from the built `.d.ts`. The snapshot is committed at
 * `packages/spec/api-surface.json`.
 *
 *   pnpm --filter @objectstack/spec gen:api-surface     # regenerate + write
 *   pnpm --filter @objectstack/spec check:api-surface   # CI: fail on any drift
 *
 * A REMOVED/renamed/kind-changed export is breaking (bump major). An ADDED
 * export is safe but still requires regenerating the snapshot — so every change
 * to the public surface is deliberate, never silent. Reads the built dist, so
 * run after `pnpm --filter @objectstack/spec build`.
 */
import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SNAPSHOT = resolve(PKG_DIR, 'api-surface.json');
const CHECK = process.argv.includes('--check');

/** Public entry points → their built CJS `.d.ts`, read from the exports map. */
function collectEntries(): Record<string, string> {
  const pkg = JSON.parse(readFileSync(resolve(PKG_DIR, 'package.json'), 'utf8'));
  const entries: Record<string, string> = {};
  for (const [sub, val] of Object.entries<any>(pkg.exports ?? {})) {
    if (!sub.startsWith('.')) continue;
    const dts = val?.require?.types ?? val?.import?.types;
    if (typeof dts === 'string' && dts.endsWith('.d.ts')) entries[sub] = resolve(PKG_DIR, dts);
  }
  return entries;
}

function kindOf(flags: ts.SymbolFlags): string {
  if (flags & ts.SymbolFlags.Function) return 'function';
  if (flags & ts.SymbolFlags.Class) return 'class';
  if (flags & ts.SymbolFlags.Enum) return 'enum';
  if (flags & ts.SymbolFlags.Interface) return 'interface';
  if (flags & ts.SymbolFlags.TypeAlias) return 'type';
  if (flags & ts.SymbolFlags.Variable) return 'const';
  if (flags & ts.SymbolFlags.Namespace) return 'namespace';
  return 'other';
}

function buildSurface(): Record<string, string[]> {
  const entries = collectEntries();
  const program = ts.createProgram(Object.values(entries), {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    skipLibCheck: true,
    noEmit: true,
  });
  const checker = program.getTypeChecker();
  const surface: Record<string, string[]> = {};
  for (const [sub, file] of Object.entries(entries)) {
    const sf = program.getSourceFile(file);
    const sym = sf && checker.getSymbolAtLocation(sf);
    if (!sym) {
      throw new Error(`Could not resolve module symbol for ${sub} (${file}). Is the package built?`);
    }
    surface[sub] = checker
      .getExportsOfModule(sym)
      .map((s) => {
        // Re-exported symbols (`export { x } from './y'`) are alias symbols;
        // resolve to the target so the kind reflects the real declaration.
        const resolved = s.getFlags() & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s;
        return `${s.getName()} (${kindOf(resolved.getFlags())})`;
      })
      // Code-unit sort (NOT localeCompare): deterministic across CI platforms.
      .sort();
  }
  return surface;
}

const current = buildSurface();
const serialized = JSON.stringify(current, null, 2) + '\n';

if (!CHECK) {
  writeFileSync(SNAPSHOT, serialized);
  const total = Object.values(current).reduce((n, a) => n + a.length, 0);
  console.log(`Wrote ${SNAPSHOT} — ${Object.keys(current).length} entries, ${total} exports.`);
  process.exit(0);
}

let previous = '';
try {
  previous = readFileSync(SNAPSHOT, 'utf8');
} catch {
  console.error('No api-surface.json snapshot found. Run `pnpm --filter @objectstack/spec gen:api-surface` and commit it.');
  process.exit(1);
}

if (previous === serialized) {
  console.log('@objectstack/spec public API surface unchanged ✓');
  process.exit(0);
}

// Drift — report removed (breaking) and added (review) per entry point.
const prev: Record<string, string[]> = JSON.parse(previous);
let removed = 0;
let added = 0;
for (const sub of new Set([...Object.keys(prev), ...Object.keys(current)])) {
  const before = new Set(prev[sub] ?? []);
  const after = new Set(current[sub] ?? []);
  const gone = [...before].filter((x) => !after.has(x));
  const fresh = [...after].filter((x) => !before.has(x));
  if (!gone.length && !fresh.length) continue;
  console.error(`\n  ${sub}`);
  for (const g of gone) { console.error(`    - ${g}`); removed++; }
  for (const f of fresh) { console.error(`    + ${f}`); added++; }
}

console.error(`\n@objectstack/spec public API surface changed: ${removed} removed, ${added} added.`);
if (removed > 0) {
  console.error('REMOVED/renamed exports are a BREAKING change for third parties — bump @objectstack/spec to a new major (or restore the export).');
}
console.error('If this is intentional, run `pnpm --filter @objectstack/spec gen:api-surface` and commit the updated snapshot.');
process.exit(1);
