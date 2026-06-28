// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.
//
// ADR-0076 D2 boundary ratchet. The lean engine entry `@objectstack/objectql/core`
// (src/core.ts) and its entire local import closure must NOT depend on the kernel
// plugin, the kernel factory, or the metadata-management protocol — so a thin
// embedder importing `@objectstack/objectql/core` never pulls
// `@objectstack/metadata-protocol` (or its 268KB) into its graph.
//
// If this test fails, you added a forbidden import somewhere reachable from
// core.ts. Keep metadata/plugin/kernel concerns out of the core closure.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));

const FORBIDDEN_PACKAGES = ['@objectstack/metadata-protocol'];
const FORBIDDEN_LOCAL = ['plugin', 'kernel-factory'];

function localImports(source: string): string[] {
  const out: string[] = [];
  const re = /(?:from|import)\s*\(?\s*['"](\.\.?\/[^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out.push(m[1]);
  return out;
}

function toTsPath(fromFile: string, spec: string): string {
  const base = resolve(dirname(fromFile), spec.replace(/\.js$/, ''));
  return base.endsWith('.ts') ? base : `${base}.ts`;
}

describe('ADR-0076 D2 — @objectstack/objectql/core boundary', () => {
  it('core.ts closure pulls neither metadata-protocol nor plugin/kernel-factory', () => {
    const entry = resolve(SRC, 'core.ts');
    const visited = new Set<string>();
    const violations: string[] = [];
    const stack = [entry];

    while (stack.length) {
      const file = stack.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);

      let src: string;
      try {
        src = readFileSync(file, 'utf8');
      } catch {
        continue; // generated / non-existent; ignore
      }

      for (const pkg of FORBIDDEN_PACKAGES) {
        if (new RegExp(`['"]${pkg.replace('/', '\\/')}['"]`).test(src)) {
          violations.push(`${file} imports forbidden package ${pkg}`);
        }
      }

      for (const spec of localImports(src)) {
        const base = spec.replace(/\.js$/, '').split('/').pop();
        if (FORBIDDEN_LOCAL.includes(base ?? '')) {
          violations.push(`${file} imports forbidden local module ./${base}`);
        }
        stack.push(toTsPath(file, spec));
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
    // sanity: the engine itself IS in the closure
    expect([...visited].some((f) => f.endsWith('/engine.ts'))).toBe(true);
  });
});
