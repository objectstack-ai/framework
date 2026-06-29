// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
import { describe, it, expect } from 'vitest';
import { validateJsxPages } from './validate-jsx-pages.js';

describe('validateJsxPages (ADR-0080 build gate)', () => {
  it('passes a well-formed jsx page', () => {
    const stack = { pages: [{ name: 'cc', kind: 'jsx', source: '<flex><text content="hi" /></flex>' }] };
    expect(validateJsxPages(stack)).toEqual([]);
  });
  it('flags an empty source on a jsx page', () => {
    expect(validateJsxPages({ pages: [{ name: 'cc', kind: 'jsx' }] }).some((f) => f.rule === 'jsx-page-empty-source')).toBe(true);
  });
  it('flags malformed jsx (mismatched close) loudly, at the source path', () => {
    const f = validateJsxPages({ pages: [{ name: 'cc', kind: 'jsx', source: '<flex><card>oops</flex>' }] });
    expect(f.some((x) => x.severity === 'error')).toBe(true);
    expect(f.every((x) => x.path === 'pages[0].source')).toBe(true);
  });
  it('rejects event handlers and dangerouslySetInnerHTML at parse level', () => {
    const f = validateJsxPages({ pages: [{ name: 'cc', kind: 'jsx', source: '<flex onClick="x()" dangerouslySetInnerHTML={{}} />' }] })
      .filter((x) => x.rule === 'jsx-forbidden-attr');
    expect(f).toHaveLength(2);
  });
  it('ignores non-jsx pages', () => {
    expect(validateJsxPages({ pages: [{ name: 'full', kind: 'full', regions: [] }] })).toEqual([]);
  });
});
