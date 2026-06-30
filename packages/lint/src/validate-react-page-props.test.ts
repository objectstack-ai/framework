// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
import { describe, it, expect } from 'vitest';
import { validateReactPageProps } from './validate-react-page-props.js';

const page = (source: string) => ({ pages: [{ name: 'p', kind: 'react', source }] });

describe('validateReactPageProps (ADR-0081 Phase 2)', () => {
  it('passes a correct ObjectForm usage', () => {
    const f = validateReactPageProps(page('function Page(){ return <ObjectForm objectName="account" mode="edit" onSuccess={()=>{}} />; }'));
    expect(f).toEqual([]);
  });

  it('flags a missing required binding (objectName)', () => {
    const f = validateReactPageProps(page('function Page(){ return <ObjectForm mode="edit" />; }'));
    expect(f.some((x) => x.rule === 'react-prop-missing-required' && /objectName/.test(x.message))).toBe(true);
  });

  it('flags a typo of a contract prop (onSucces → onSuccess)', () => {
    const f = validateReactPageProps(page('function Page(){ return <ObjectForm objectName="a" onSucces={()=>{}} />; }'));
    expect(f.some((x) => x.rule === 'react-prop-typo' && /onSuccess/.test(x.message))).toBe(true);
  });

  it('flags ListView onRowClik typo', () => {
    const f = validateReactPageProps(page('function Page(){ return <ListView objectName="a" onRowClik={()=>{}} />; }'));
    expect(f.some((x) => x.rule === 'react-prop-typo' && /onRowClick/.test(x.message))).toBe(true);
  });

  it('does NOT flag a spread (props may come from it)', () => {
    const f = validateReactPageProps(page('function Page(){ const p={objectName:"a"}; return <ObjectForm {...p} />; }'));
    expect(f).toEqual([]);
  });

  it('ignores unknown components (author HTML / own components)', () => {
    const f = validateReactPageProps(page('function Page(){ return <div className="x"><MyThing foo="bar" /></div>; }'));
    expect(f).toEqual([]);
  });

  it('does NOT false-flag a valid non-contract prop (no near match)', () => {
    const f = validateReactPageProps(page('function Page(){ return <ListView objectName="a" striped={true} />; }'));
    expect(f).toEqual([]);
  });
});
