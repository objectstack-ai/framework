// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
import { describe, it, expect } from 'vitest';
import { validateReactPages } from './validate-react-pages.js';

describe('validateReactPages (ADR-0081 syntax gate)', () => {
  it('passes a well-formed react page', () => {
    const stack = {
      pages: [{
        name: 'wb', kind: 'react',
        source: 'function Page(){ const [n,setN]=React.useState(0); return <button onClick={()=>setN(n+1)}>{n}</button>; }',
      }],
    };
    expect(validateReactPages(stack)).toEqual([]);
  });

  it('flags an empty source', () => {
    const f = validateReactPages({ pages: [{ name: 'wb', kind: 'react' }] });
    expect(f.some((x) => x.rule === 'react-page-empty-source')).toBe(true);
  });

  it('flags a syntax error (unterminated JSX), at the source path', () => {
    const f = validateReactPages({ pages: [{ name: 'wb', kind: 'react', source: 'function Page(){ return <div>oops; }' }] });
    expect(f.some((x) => x.rule === 'react-page-syntax' && x.severity === 'error')).toBe(true);
    expect(f.every((x) => x.path === 'pages[0].source')).toBe(true);
  });

  it('ignores non-react pages (html/full)', () => {
    expect(validateReactPages({ pages: [
      { name: 'h', kind: 'html', source: '<flex/>' },
      { name: 'f', kind: 'full', regions: [] },
    ] })).toEqual([]);
  });
});
