// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.
//
// Lazify codemod — wrap every `export const XxxSchema = <expr>;` in
// `lazySchema(() => <expr>)` so Zod construction is deferred until first use.
//
// Usage:
//   pnpm tsx scripts/lazify-schemas.ts                 # transform src/**/*.zod.ts
//   pnpm tsx scripts/lazify-schemas.ts --dry           # preview, do not write
//   pnpm tsx scripts/lazify-schemas.ts src/data        # restrict to a subdir
//
// Strategy: parse each .zod.ts as text, find top-level
// `export const NAME(\s*:\s*Type)? = <expr>;` declarations, and rewrite to
// `export const NAME$1 = lazySchema(() => <expr>);`. Brace/paren/bracket/template
// depth is tracked to find the terminating semicolon. String literals and
// comments are skipped to avoid false matches.
//
// Skipped:
//   - lines whose RHS is exactly `z.lazy(...)` — already lazy
//   - already-wrapped declarations (RHS starts with `lazySchema(`)
//   - non-`Schema`-suffixed identifiers
//
// The codemod also injects:
//   `import { lazySchema } from '<relative path>/shared/lazy-schema';`
// if not already present.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(repoRoot, 'src');
const sharedDir = path.join(srcRoot, 'shared');

interface Args {
  dry: boolean;
  targets: string[];
}

function parseArgs(argv: string[]): Args {
  const dry = argv.includes('--dry');
  const targets = argv.filter((a) => !a.startsWith('--'));
  if (targets.length === 0) targets.push(srcRoot);
  return { dry, targets: targets.map((t) => path.resolve(t)) };
}

function listZodFiles(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name.startsWith('.')) continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) visit(p);
      else if (ent.isFile() && ent.name.endsWith('.zod.ts')) out.push(p);
    }
  };
  if (fs.statSync(root).isDirectory()) visit(root);
  else out.push(root);
  return out;
}

interface Decl {
  start: number;          // index of `export`
  rhsStart: number;       // index just after `=`
  end: number;            // index of `;` (inclusive)
  name: string;
  signature: string;      // text from `export const NAME(:Type)? = ` (the prefix to keep)
  rhs: string;            // raw RHS without trailing `;`
}

// Find top-level `export const NAME(:Type)? = <expr>;` declarations in source.
// Honors string/comment/template boundaries so braces inside them don't
// confuse depth tracking.
function findDeclarations(src: string): Decl[] {
  const decls: Decl[] = [];
  const len = src.length;
  let i = 0;
  let depth = 0;          // top-level when 0
  // scan top-level only; inside any nested block we skip
  while (i < len) {
    // Skip whitespace
    if (src[i] === ' ' || src[i] === '\t' || src[i] === '\n' || src[i] === '\r') { i++; continue; }
    // Skip line comment
    if (src[i] === '/' && src[i + 1] === '/') {
      while (i < len && src[i] !== '\n') i++;
      continue;
    }
    // Skip block comment
    if (src[i] === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < len && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // String / template literal
    if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      i = skipString(src, i);
      continue;
    }
    // Brace-aware nesting at top level
    if (src[i] === '{' || src[i] === '(' || src[i] === '[') { depth++; i++; continue; }
    if (src[i] === '}' || src[i] === ')' || src[i] === ']') { depth--; i++; continue; }

    if (depth === 0 && src.startsWith('export', i)) {
      const m = matchExportConst(src, i);
      if (m) {
        decls.push(m);
        i = m.end + 1;
        continue;
      }
    }
    i++;
  }
  return decls;
}

function skipString(src: string, start: number): number {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
      // template expression — skip balanced
      i += 2;
      let d = 1;
      while (i < src.length && d > 0) {
        if (src[i] === '"' || src[i] === "'" || src[i] === '`') { i = skipString(src, i); continue; }
        if (src[i] === '{') d++;
        else if (src[i] === '}') d--;
        i++;
      }
      continue;
    }
    if (src[i] === quote) return i + 1;
    i++;
  }
  return i;
}

const HEADER_RE = /^export\s+const\s+([A-Za-z_$][\w$]*)(\s*:\s*[^=]+?)?\s*=\s*/;

function matchExportConst(src: string, start: number): Decl | null {
  const slice = src.slice(start, start + 4096);
  const m = HEADER_RE.exec(slice);
  if (!m) return null;
  const name = m[1];
  if (!name.endsWith('Schema') && !name.endsWith('Schemas')) {
    // Only target *Schema / *Schemas exports
    return null;
  }
  const rhsStart = start + m[0].length;

  // Walk RHS until balanced top-level `;`
  const len = src.length;
  let i = rhsStart;
  let depth = 0;
  while (i < len) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < len && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      i += 2; while (i < len && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue;
    }
    if (c === '"' || c === "'" || c === '`') { i = skipString(src, i); continue; }
    if (c === '{' || c === '(' || c === '[') { depth++; i++; continue; }
    if (c === '}' || c === ')' || c === ']') { depth--; i++; continue; }
    if (c === ';' && depth === 0) {
      const rhs = src.slice(rhsStart, i).trimEnd();
      return {
        start, rhsStart, end: i, name,
        signature: src.slice(start, rhsStart),
        rhs,
      };
    }
    i++;
  }
  return null;
}

function shouldSkip(rhs: string): boolean {
  const trimmed = rhs.trim();
  if (trimmed.startsWith('lazySchema(')) return true;
  if (/^z\.lazy\s*\(/.test(trimmed)) return true;
  return false;
}

function relImportPath(file: string): string {
  const fileDir = path.dirname(file);
  const target = path.join(sharedDir, 'lazy-schema');
  let rel = path.relative(fileDir, target);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function ensureLazyImport(src: string, file: string): string {
  if (/from ['"][^'"]*shared\/lazy-schema['"]/.test(src)) return src;
  const importPath = relImportPath(file);
  const importLine = `import { lazySchema } from '${importPath}';\n`;

  // Insert after the last top-level `import ... from '...';` in the file header.
  // Stop at the first non-import, non-comment statement.
  const importBlock = /^(?:[ \t]*\/\/[^\n]*\n|[ \t]*\/\*[\s\S]*?\*\/\s*\n|[ \t]*import[\s\S]*?from[ \t]*['"][^'"]+['"];[ \t]*\n|[ \t]*\n)+/.exec(src);
  if (importBlock) {
    const idx = importBlock[0].length;
    return src.slice(0, idx) + importLine + src.slice(idx);
  }
  return importLine + src;
}

function transform(src: string, file: string): { out: string; changed: number; skipped: number } {
  const decls = findDeclarations(src);
  if (decls.length === 0) return { out: src, changed: 0, skipped: 0 };

  // Process in reverse so offsets stay valid
  let out = src;
  let changed = 0;
  let skipped = 0;
  for (let k = decls.length - 1; k >= 0; k--) {
    const d = decls[k];
    if (shouldSkip(d.rhs)) { skipped++; continue; }
    const wrapped = `lazySchema(() => ${d.rhs})`;
    out = out.slice(0, d.rhsStart) + wrapped + out.slice(d.end);
    changed++;
  }

  if (changed > 0) out = ensureLazyImport(out, file);
  return { out, changed, skipped };
}

function main() {
  const { dry, targets } = parseArgs(process.argv.slice(2));
  const files = targets.flatMap(listZodFiles);
  console.log(`Found ${files.length} .zod.ts files in ${targets.length} target(s)`);

  let totalChanged = 0;
  let totalSkipped = 0;
  let filesChanged = 0;

  for (const file of files) {
    // Don't transform the lazy-schema utility itself
    if (file.endsWith('lazy-schema.ts') || file.endsWith('lazy-schema.test.ts')) continue;

    const src = fs.readFileSync(file, 'utf8');
    const { out, changed, skipped } = transform(src, file);
    totalChanged += changed;
    totalSkipped += skipped;
    if (changed > 0) {
      filesChanged++;
      const rel = path.relative(repoRoot, file);
      console.log(`  ${dry ? '[dry] ' : ''}${rel}: +${changed} wrapped, ${skipped} skipped`);
      if (!dry) fs.writeFileSync(file, out);
    }
  }

  console.log(`\n${dry ? '[DRY] ' : ''}Done. ${filesChanged} files, ${totalChanged} schemas wrapped, ${totalSkipped} skipped.`);
}

main();
