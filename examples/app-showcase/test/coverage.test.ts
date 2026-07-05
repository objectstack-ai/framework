// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { existsSync } from 'node:fs';

import { describe, it, expect } from 'vitest';
import { FlowNodeAction } from '@objectstack/spec/automation';
import { FieldType } from '@objectstack/spec/data';
import { DEFAULT_METADATA_TYPE_REGISTRY } from '@objectstack/spec/kernel';
import * as ui from '@objectstack/spec/ui';

import * as objects from '../src/data/objects/index.js';
import { allFlows } from '../src/automation/flows/index.js';
import { TaskViews, ProjectViews } from '../src/ui/views/index.js';
import { ChartGalleryDashboard } from '../src/ui/dashboards/index.js';
import { allReports } from '../src/ui/reports/index.js';
import { allActions } from '../src/ui/actions/index.js';
import {
  KIND_COVERAGE,
  STACK_COLLECTION_COVERAGE,
  FLOW_NODE_WAIVERS,
  LIST_VIEW_TYPES,
  FORM_VIEW_TYPES,
  collectFieldTypes,
  collectFlowNodeTypes,
  collectListViewTypes,
  collectFormViewTypes,
} from '../src/coverage.js';

// vitest runs with cwd = the package root (pnpm --filter executes there).
const PACKAGE_ROOT = process.cwd();

/** Read the string members of a Zod enum (or a plain array constant). */
function enumValues(schema: unknown): string[] {
  const s = schema as { options?: string[]; _def?: { values?: string[] } };
  if (Array.isArray(schema)) return schema as string[];
  return s?.options ?? s?._def?.values ?? [];
}

/** Assert every member of `expected` appears in `used`, reporting the gap. */
function expectFullCoverage(label: string, expected: string[], used: Set<string>) {
  const missing = expected.filter((v) => !used.has(v));
  expect(missing, `${label}: uncovered → ${missing.join(', ')}`).toEqual([]);
}

const objectList = Object.values(objects);
const views = [TaskViews, ProjectViews];

describe('showcase coverage (introspected against the spec)', () => {
  it('covers every FieldType', () => {
    const expected = enumValues(FieldType);
    expect(expected.length).toBeGreaterThan(40);
    expectFullCoverage('FieldType', expected, collectFieldTypes(objectList as never));
  });

  it('covers every list-view type', () => {
    expectFullCoverage('ListViewType', [...LIST_VIEW_TYPES], collectListViewTypes(views as never));
  });

  it('covers every form-view type', () => {
    expectFullCoverage('FormViewType', [...FORM_VIEW_TYPES], collectFormViewTypes(views as never));
  });

  it('covers every distinctly-renderable ChartType', () => {
    // The fallback-only VARIANTS (grouped/stacked/bi-polar bar, stacked-area,
    // step-line, spline, pyramid, bubble) were removed from `ChartTypeSchema`, so
    // the enum now lists only families that render. The remaining exception is
    // the performance group: `metric` represents the single-value KPI, and
    // `kpi`/`gauge`/`solid-gauge`/`bullet` render the SAME value today (no dial),
    // so the gallery demonstrates `metric` once rather than duplicating them.
    const SAME_AS_METRIC = new Set(['kpi', 'gauge', 'solid-gauge', 'bullet']);
    const expected = enumValues(ui.ChartTypeSchema).filter((t) => !SAME_AS_METRIC.has(t));
    const used = new Set<string>();
    for (const w of ChartGalleryDashboard.widgets ?? []) if (w.type) used.add(w.type);
    expectFullCoverage('ChartType', expected, used);
  });

  it('covers every report type', () => {
    // ADR-0021 single-form: `tabular` (a flat record list) is intentionally NOT
    // demonstrated as a report — a flat list is an object-bound ListView lens
    // (ADR-0017), not an analytics projection, so the former TaskListReport now
    // lives on showcase_task as a `tabular` ListView (see src/ui/reports/index.ts).
    const expected = enumValues((ui as Record<string, unknown>).ReportType ?? (ui as Record<string, unknown>).ReportTypeSchema)
      .filter((t) => t !== 'tabular');
    const used = new Set<string>();
    for (const r of allReports) {
      if (r.type) used.add(r.type);
      for (const b of (r as { blocks?: Array<{ type?: string }> }).blocks ?? []) if (b.type) used.add(b.type);
    }
    expectFullCoverage('ReportType', expected, used);
  });

  describe('metadata kinds (introspected against DEFAULT_METADATA_TYPE_REGISTRY)', () => {
    const registryKinds = DEFAULT_METADATA_TYPE_REGISTRY.map((e) => e.type);
    const manifests = { KIND_COVERAGE, STACK_COLLECTION_COVERAGE } as const;

    it('accounts for every kind in the registry — demonstrated or waived', () => {
      const missing = registryKinds.filter((k) => !(k in KIND_COVERAGE));
      expect(missing, `new registry kinds not yet in KIND_COVERAGE → ${missing.join(', ')}`).toEqual([]);
    });

    it('carries no entry the registry no longer knows', () => {
      const stale = Object.keys(KIND_COVERAGE).filter((k) => !registryKinds.includes(k as never));
      expect(stale, `stale KIND_COVERAGE entries → ${stale.join(', ')}`).toEqual([]);
    });

    for (const [manifestName, manifest] of Object.entries(manifests)) {
      it(`${manifestName}: demonstrated entries point at files that exist`, () => {
        for (const [kind, entry] of Object.entries(manifest)) {
          if (entry.status !== 'demonstrated') continue;
          expect(entry.files.length, `${kind}: demonstrated but lists no files`).toBeGreaterThan(0);
          for (const file of entry.files) {
            expect(existsSync(`${PACKAGE_ROOT}/${file}`), `${kind}: missing proof file ${file}`).toBe(true);
          }
        }
      });

      it(`${manifestName}: waived entries carry a reason and a GitHub issue link`, () => {
        for (const [kind, entry] of Object.entries(manifest)) {
          if (entry.status !== 'waived') continue;
          expect(entry.reason.length, `${kind}: waiver without a substantive reason`).toBeGreaterThan(20);
          expect(entry.issue, `${kind}: waiver must link the tracking issue`).toMatch(
            /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(issues|pull)\/\d+$/,
          );
        }
      });
    }
  });

  it('covers every built-in flow node type — or waives it with a reason', () => {
    const all = enumValues(FlowNodeAction);
    // Every waiver must name a real enum member and carry a substantive reason.
    for (const [type, reason] of Object.entries(FLOW_NODE_WAIVERS)) {
      expect(all, `FLOW_NODE_WAIVERS names unknown node type '${type}'`).toContain(type);
      expect(reason.length, `flow-node waiver '${type}' needs a substantive reason`).toBeGreaterThan(20);
    }
    const expected = all.filter((t) => !(t in FLOW_NODE_WAIVERS));
    expectFullCoverage('FlowNodeAction', expected, collectFlowNodeTypes(allFlows as never));
  });

  it('covers every action type and location', () => {
    const types = enumValues((ui as Record<string, unknown>).ActionType ?? (ui as Record<string, unknown>).ActionTypeSchema);
    const locations = enumValues((ui as Record<string, unknown>).ACTION_LOCATIONS ?? (ui as Record<string, unknown>).ActionLocationSchema);

    const usedTypes = new Set<string>();
    const usedLocations = new Set<string>();
    for (const a of allActions) {
      if (a.type) usedTypes.add(a.type);
      for (const loc of a.locations ?? []) usedLocations.add(loc);
    }
    expectFullCoverage('ActionType', types, usedTypes);
    expectFullCoverage('ActionLocation', locations, usedLocations);
  });
});
