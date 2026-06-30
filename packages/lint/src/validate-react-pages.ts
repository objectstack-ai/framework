// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Build-time syntax gate for `kind:'react'` pages (ADR-0081).
//
// A react page's `source` is REAL JavaScript/JSX executed at render by the
// runtime — so the constrained JSX parser (validate-jsx-pages) cannot check it.
// We instead transpile it with Sucrase (the same transpiler the runtime uses),
// transpile-ONLY — never executed — to surface syntax errors at `os build`
// instead of at render (ADR-0078: fail loudly at author time). It does NOT
// validate runtime behaviour (a transpiling page can still throw at render);
// the render-time error boundary owns that.

import { transform } from 'sucrase';

export type ReactPageSeverity = 'error' | 'warning';

export interface ReactPageFinding {
  severity: ReactPageSeverity;
  rule: string;
  where: string;
  path: string;
  message: string;
  hint: string;
}

type AnyRec = Record<string, unknown>;
const asArray = (v: unknown): AnyRec[] => (Array.isArray(v) ? (v as AnyRec[]) : []);

export function validateReactPages(stack: AnyRec): ReactPageFinding[] {
  const findings: ReactPageFinding[] = [];
  const pages = asArray(stack.pages);
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    if (!page || page.kind !== 'react') continue;
    const name = String(page.name ?? `#${p}`);
    const source = page.source;
    if (typeof source !== 'string' || source.trim() === '') {
      findings.push({
        severity: 'error',
        rule: 'react-page-empty-source',
        where: `page "${name}"`,
        path: `pages[${p}].source`,
        message: "kind:'react' page has no `source`.",
        hint: 'Author the page as a real React component string in `source`.',
      });
      continue;
    }
    try {
      // transpile-only (no eval) — catches syntax errors, unterminated JSX, etc.
      transform(source, { transforms: ['jsx', 'typescript'], production: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      findings.push({
        severity: 'error',
        rule: 'react-page-syntax',
        where: `page "${name}"`,
        path: `pages[${p}].source`,
        message: `kind:'react' source has a syntax error: ${message.split('\n')[0]}`,
        hint: 'The source is transpiled (never executed) at build to catch syntax errors early — fix the JS/JSX.',
      });
    }
  }
  return findings;
}
