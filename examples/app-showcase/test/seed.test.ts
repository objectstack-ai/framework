// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import stack from '../objectstack.config.js';
import { ShowcaseSeedData } from '../src/data/seed/index.js';

/**
 * Smoke test — the stack loads and registers the expected breadth of
 * metadata. This guards the metadata-loading pipeline end-to-end.
 */
describe('showcase stack', () => {
  it('registers the core objects', () => {
    const names = (stack.objects ?? []).map((o: { name: string }) => o.name);
    expect(names).toContain('showcase_project');
    expect(names).toContain('showcase_task');
    expect(names).toContain('showcase_field_zoo');
    // 6 objects: account, project, task, category, team, membership, field_zoo
    expect((stack.objects ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it('registers UI, automation, security, and AI metadata', () => {
    expect((stack.views ?? []).length).toBeGreaterThan(0);
    expect((stack.dashboards ?? []).length).toBeGreaterThan(0);
    // ADR-0021 single-form: the former flat `tabular` TaskListReport was
    // reclassified as a ListView (a flat list is a row lens, not analytics),
    // leaving 3 dataset-bound analytics reports.
    expect((stack.reports ?? []).length).toBe(3);
    expect((stack.flows ?? []).length).toBeGreaterThan(0);
    // Nine flat positions (contributor/manager/exec/auditor/ops/
    // field_ops_delegate/client_portal_user, plus finance/legal for the v16
    // approval sign-off flows) — the ADR-0090 distribution layer; `everyone`
    // and `guest` are built-in anchors and never declared by the app.
    expect((stack.positions ?? []).length).toBe(9);
    expect((stack.agents ?? []).length).toBe(0); // AI agents are an enterprise (service-ai) feature; the open showcase ships none
  });
});

/**
 * Static shadow of what SeedLoader + validation do at boot (#3415): for every
 * object whose state_machine gates INSERT (`initialStates`), replay the seed
 * datasets in declaration order and assert each record enters through a legal
 * initial state and only moves along declared transitions. The fixture that
 * silently lost 4/5 projects (target status written directly on insert) can
 * never come back green.
 */
describe('seed data vs state machines (#3415)', () => {
  const gated = (stack.objects ?? []).flatMap((o: any) =>
    (o.validations ?? [])
      .filter(
        (v: any) =>
          v.type === 'state_machine' &&
          (v.events ?? []).includes('insert') &&
          Array.isArray(v.initialStates) &&
          v.severity !== 'warning',
      )
      .map((v: any) => ({ object: o, rule: v })),
  );

  it('covers the project status flow (the #3415 gate)', () => {
    expect(gated.map((g: any) => `${g.object.name}.${g.rule.field}`)).toContain('showcase_project.status');
  });

  for (const { object, rule } of gated) {
    it(`${object.name}: seeded '${rule.field}' respects initialStates and transitions — including on replay`, () => {
      const datasets = ShowcaseSeedData.filter((d: any) => d.object === object.name);
      expect(datasets.length).toBeGreaterThan(0);
      const current = new Map<string, string>();
      // Round 1 = fresh boot; round 2 = replay against the walked state.
      // Replay must also be violation-free (#3415 follow-up): `ignore`
      // datasets skip existing rows wholesale, and re-walked hops must be
      // legal transitions (which is what the reopen edge guarantees).
      for (const round of [1, 2]) {
        for (const ds of datasets as any[]) {
          for (const rec of ds.records as any[]) {
            const key = String(rec[ds.externalId ?? 'name']);
            const next = rec[rule.field];
            if (!current.has(key)) {
              // First appearance = INSERT. Seed inserts do NOT apply select
              // defaults, so a gated field must be explicit AND legal.
              expect(next, `'${key}' (round ${round}) must seed '${rule.field}' explicitly`).toBeDefined();
              expect(rule.initialStates, `'${key}' enters as '${next}'`).toContain(next);
              current.set(key, next);
            } else {
              if (ds.mode === 'ignore') continue; // existing rows untouched
              if (next === undefined || next === current.get(key)) continue; // no-op replay skips
              const from = current.get(key)!;
              expect(rule.transitions?.[from] ?? [], `'${key}' (round ${round}) ${from} → ${next}`).toContain(next);
              current.set(key, next);
            }
          }
        }
      }
    });
  }
});
