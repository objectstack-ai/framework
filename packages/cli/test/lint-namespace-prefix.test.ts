// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, expect, it } from 'vitest';
import { lintConfig } from '../src/commands/lint';

const RULE = 'naming/namespace-prefix';
const prefixIssues = (config: any) => lintConfig(config).filter((i) => i.rule === RULE);

describe('lint — namespace-prefix advisory (ADR-0048 §3.3)', () => {
  it('warns on a bare-named page without the namespace prefix', () => {
    const issues = prefixIssues({
      manifest: { namespace: 'crm' },
      pages: [{ name: 'home', label: 'Home' }],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].path).toBe('pages[0].name');
    expect(issues[0].fix).toBe('crm_home');
    expect(issues[0].message).toContain('ADR-0048');
  });

  it('accepts a namespace-prefixed name', () => {
    expect(
      prefixIssues({ manifest: { namespace: 'crm' }, flows: [{ name: 'crm_onboarding' }] }),
    ).toHaveLength(0);
  });

  it('exempts an app named after the namespace (ADR-0019 single-app convention)', () => {
    // `defineApp({ name: 'crm' })` in namespace `crm` must NOT warn.
    expect(
      prefixIssues({ manifest: { namespace: 'crm' }, apps: [{ name: 'crm' }] }),
    ).toHaveLength(0);
  });

  it('exempts platform-reserved sys_ names', () => {
    expect(
      prefixIssues({ manifest: { namespace: 'crm' }, pages: [{ name: 'sys_admin' }] }),
    ).toHaveLength(0);
  });

  it('covers every bare-named UI/automation type', () => {
    const issues = prefixIssues({
      manifest: { namespace: 'crm' },
      apps: [{ name: 'other' }],
      pages: [{ name: 'home' }],
      dashboards: [{ name: 'overview' }],
      flows: [{ name: 'onboard' }],
      actions: [{ name: 'send' }],
      reports: [{ name: 'pipeline' }],
      datasets: [{ name: 'sales' }],
    });
    expect(issues).toHaveLength(7);
    expect(new Set(issues.map((i) => i.severity))).toEqual(new Set(['warning']));
  });

  it('is silent when the package declares no namespace', () => {
    // No manifest.namespace → nothing to prefix against; stays quiet.
    expect(prefixIssues({ pages: [{ name: 'home' }] })).toHaveLength(0);
  });

  it('does not touch objects (already prefix-enforced as an error) or views', () => {
    const issues = prefixIssues({
      manifest: { namespace: 'crm' },
      objects: [{ name: 'lead', fields: { id: { type: 'text' } } }],
      views: [{ name: 'lead.all' }],
    });
    expect(issues).toHaveLength(0);
  });
});
