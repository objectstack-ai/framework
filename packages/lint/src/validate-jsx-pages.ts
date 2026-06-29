// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Build-time diagnostics for AI-authored JSX-source pages (ADR-0080).
//
// A pure `(stack) => Finding[]` rule (ADR-0019), run from `os validate` / `os
// build`. A `kind:'jsx'` page's `source` is a constrained JSX/Tailwind string
// compiled (parsed, never executed) to the SDUI tree at save time. This gate
// parses it at author time so malformed source fails loudly (ADR-0078) instead
// of being stored and breaking only at render.
//
// Scope: parse-level — syntax, tag matching, and forbidden constructs (event
// handlers, dangerouslySetInnerHTML). Full component/prop whitelist validation
// needs the registry manifest (a cross-repo artifact); when that is wired,
// thread it through `compile()` here. Until then this catches the structural
// class of error an AI author is most likely to emit.

import { parseJsx } from '@objectstack/sdui-parser';

export type JsxPageSeverity = 'error' | 'warning';

export interface JsxPageFinding {
  severity: JsxPageSeverity;
  rule: string;
  /** Human-readable location, e.g. `page "command_center" › <flex>`. */
  where: string;
  /** Config path, e.g. `pages[3].source`. */
  path: string;
  message: string;
  hint: string;
}

type AnyRec = Record<string, unknown>;
const asArray = (v: unknown): AnyRec[] => (Array.isArray(v) ? (v as AnyRec[]) : []);

export function validateJsxPages(stack: AnyRec): JsxPageFinding[] {
  const findings: JsxPageFinding[] = [];
  const pages = asArray(stack.pages);
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    if (!page || page.kind !== 'jsx') continue;
    const name = String(page.name ?? `#${p}`);
    const source = page.source;
    if (typeof source !== 'string' || source.trim() === '') {
      // (PageSchema's superRefine also covers this; keep it for the build path.)
      findings.push({
        severity: 'error',
        rule: 'jsx-page-empty-source',
        where: `page "${name}"`,
        path: `pages[${p}].source`,
        message: "kind:'jsx' page has no `source`.",
        hint: 'Author the page as a constrained JSX/Tailwind string in `source`.',
      });
      continue;
    }
    const { diagnostics } = parseJsx(source);
    for (const d of diagnostics) {
      findings.push({
        severity: d.severity,
        rule: `jsx-${d.code}`,
        where: d.tag ? `page "${name}" › <${d.tag}>` : `page "${name}"`,
        path: `pages[${p}].source`,
        message: d.message,
        hint: 'The source is parsed (never executed) and compiled to the SDUI tree at save time — fix the JSX.',
      });
    }
  }
  return findings;
}
