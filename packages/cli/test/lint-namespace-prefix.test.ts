// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, expect, it } from 'vitest';
import { lintConfig } from '../src/commands/lint';

const RULE = 'naming/namespace-prefix';
const prefixIssues = (config: any) => lintConfig(config).filter((i) => i.rule === RULE);

describe('lint — intra-package duplicate-name advisory (ADR-0048 §3.4)', () => {
  it('stays silent on unique bare names — they are NOT a collision (ADR-0048 §3.4)', () => {
    // The cross-package throw was retired: distinct packages coexist on the
    // same bare name via package-scoped resolution. A single package with
    // unique bare names must produce zero warnings (was 63 false positives
    // for hotcrm under the old over-broad rule).
    const issues = prefixIssues({
      manifest: { namespace: 'crm' },
      apps: [{ name: 'crm' }],
      pages: [{ name: 'home' }, { name: 'settings' }],
      dashboards: [{ name: 'overview' }],
      flows: [{ name: 'onboard' }],
      actions: [{ name: 'send' }],
      reports: [{ name: 'pipeline' }],
      datasets: [{ name: 'sales' }],
    });
    expect(issues).toHaveLength(0);
  });

  it('warns on an actual intra-package duplicate (type, name) pair', () => {
    const issues = prefixIssues({
      manifest: { namespace: 'crm' },
      pages: [{ name: 'home', label: 'Home' }, { name: 'home', label: 'Home 2' }],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    // The warning points at the duplicate occurrence, not the first.
    expect(issues[0].path).toBe('pages[1].name');
    expect(issues[0].message).toContain('declared more than once');
    expect(issues[0].message).toContain('pages[0].name');
    expect(issues[0].message).toContain('ADR-0048');
    // Suggests a namespace-prefixed rename when a namespace is available.
    expect(issues[0].fix).toBe('crm_home');
  });

  it('does not claim the package will fail at install', () => {
    const issues = prefixIssues({
      manifest: { namespace: 'crm' },
      flows: [{ name: 'onboard' }, { name: 'onboard' }],
    });
    expect(issues).toHaveLength(1);
    // ADR-0048 §3.4 retired the per-item cross-package throw — the old
    // "collide on the registry key and fail at install" claim is false.
    expect(issues[0].message).not.toContain('fail at install');
    expect(issues[0].message).not.toContain('Two packages');
  });

  it('detects duplicates per type independently across every bare-named type', () => {
    const issues = prefixIssues({
      manifest: { namespace: 'crm' },
      apps: [{ name: 'a' }, { name: 'a' }],
      pages: [{ name: 'p' }, { name: 'p' }],
      dashboards: [{ name: 'd' }, { name: 'd' }],
      flows: [{ name: 'f' }, { name: 'f' }],
      actions: [{ name: 'ac' }, { name: 'ac' }],
      reports: [{ name: 'r' }, { name: 'r' }],
      datasets: [{ name: 'ds' }, { name: 'ds' }],
    });
    expect(issues).toHaveLength(7);
    expect(new Set(issues.map((i) => i.severity))).toEqual(new Set(['warning']));
  });

  it('treats the same name under different types as distinct (no false positive)', () => {
    // `page/home` and `flow/home` live under different registry collections —
    // they do not collide, so a shared name across types must not warn.
    expect(
      prefixIssues({
        manifest: { namespace: 'crm' },
        pages: [{ name: 'home' }],
        flows: [{ name: 'home' }],
      }),
    ).toHaveLength(0);
  });

  it('warns on duplicates even when no namespace is declared (omits the fix)', () => {
    // Duplicate names shadow each other regardless of namespace; without a
    // namespace there is no prefix to suggest, so no `fix` is offered.
    const issues = prefixIssues({
      pages: [{ name: 'home' }, { name: 'home' }],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].fix).toBeUndefined();
    expect(issues[0].message).toContain('declared more than once');
  });

  it('does not touch objects (already prefix-enforced as an error) or views', () => {
    const issues = prefixIssues({
      manifest: { namespace: 'crm' },
      objects: [
        { name: 'lead', fields: { id: { type: 'text' } } },
        { name: 'lead', fields: { id: { type: 'text' } } },
      ],
      views: [{ name: 'lead.all' }, { name: 'lead.all' }],
    });
    expect(issues).toHaveLength(0);
  });
});
