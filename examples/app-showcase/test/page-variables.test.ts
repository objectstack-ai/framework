// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';

import { PageVariablesPage } from '../src/ui/pages/index.js';
import stack from '../objectstack.config.js';
import { ShowcaseApp } from '../src/ui/apps/index.js';

/**
 * Dogfood gate for page-local state (PageSchema.variables, ADR-0049).
 *
 * In the "demonstrated AND verified" spirit: it is not enough that the page
 * *declares* a variable and a picker. These assertions prove the wiring is
 * coherent end-to-end — the variable names a real writer component, the gating
 * predicates reference that variable, and (crucially) the predicates actually
 * gate the way the demo claims when the variable flips. A page that merely
 * looked plausible but mis-wired the `source` id or inverted a predicate would
 * pass a shape-only check but fail here.
 */

type AnyComponent = {
  type: string;
  id?: string;
  visibility?: unknown;
  [k: string]: unknown;
};

/** Flatten every component across the page's regions. */
function allComponents(page: typeof PageVariablesPage): AnyComponent[] {
  const out: AnyComponent[] = [];
  for (const region of page.regions ?? []) {
    for (const c of region.components ?? []) out.push(c as AnyComponent);
  }
  return out;
}

/** Extract a predicate's CEL source whether stored as a bare string or the
 *  normalized `{ dialect, source }` envelope that definePage produces. */
function predicateSource(visibility: unknown): string | undefined {
  if (typeof visibility === 'string') return visibility;
  if (visibility && typeof visibility === 'object' && typeof (visibility as any).source === 'string') {
    return (visibility as any).source;
  }
  return undefined;
}

/** Evaluate a (simple, comparison-only) CEL predicate against a page scope.
 *  Sufficient for the `==` / `!=` predicates this page uses. */
function evalPredicate(source: string, page: Record<string, unknown>): boolean {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const fn = new Function('page', `"use strict"; return (${source});`) as (
    p: Record<string, unknown>,
  ) => boolean;
  return Boolean(fn(page));
}

describe('Page Variables showcase — page-local state (ADR-0049)', () => {
  it('parses and declares the selectedProjectId variable bound to the picker', () => {
    expect(PageVariablesPage.name).toBe('showcase_page_variables');

    const vars = PageVariablesPage.variables ?? [];
    const sel = vars.find((v) => v.name === 'selectedProjectId');
    expect(sel, 'selectedProjectId variable must exist').toBeTruthy();
    expect(sel!.type).toBe('record_id');
    // source names the WRITER component id.
    expect(sel!.source).toBe('project_picker');
  });

  it('ships a record picker whose id matches the variable source', () => {
    const picker = allComponents(PageVariablesPage).find((c) => c.id === 'project_picker');
    expect(picker, 'a component with id project_picker must exist').toBeTruthy();
    expect(picker!.type).toBe('element:record_picker');
    // It binds to a real object so the picker has something to load.
    expect((picker as any).dataSource?.object).toBe('showcase_project');
  });

  it('gates its detail panel on the variable — hidden until a project is picked, shown after', () => {
    const comps = allComponents(PageVariablesPage);
    const gated = comps.filter((c) => c.visibility !== undefined);
    // Empty-hint + divider + heading + body — every gated node references the variable.
    expect(gated.length).toBeGreaterThanOrEqual(2);

    const empty = { page: { selectedProjectId: '' } as Record<string, unknown> };
    const picked = { page: { selectedProjectId: 'proj_42' } as Record<string, unknown> };

    let shownWhenEmpty = 0;
    let shownWhenPicked = 0;
    for (const c of gated) {
      const src = predicateSource(c.visibility);
      expect(src, `gated component ${c.id} must carry a predicate`).toBeTruthy();
      // Every gating predicate is about the page variable.
      expect(src).toContain('page.selectedProjectId');
      if (evalPredicate(src!, empty.page)) shownWhenEmpty++;
      if (evalPredicate(src!, picked.page)) shownWhenPicked++;
    }

    // The empty-state hint shows only when nothing is picked; the detail panel
    // (divider + heading + body) shows only after a pick. So the visible set
    // strictly flips between the two states — proving the variable drives the UI.
    expect(shownWhenEmpty).toBeGreaterThanOrEqual(1); // the empty hint
    expect(shownWhenPicked).toBeGreaterThanOrEqual(1); // the detail panel
    // The empty-state predicate and the detail predicates are mutually exclusive:
    // no gated node is visible in BOTH states.
    for (const c of gated) {
      const src = predicateSource(c.visibility)!;
      const inEmpty = evalPredicate(src, empty.page);
      const inPicked = evalPredicate(src, picked.page);
      expect(inEmpty && inPicked, `component ${c.id} should not be visible in both states`).toBe(false);
    }
  });

  it('is registered in the app config and reachable from navigation', () => {
    const pageNames = (stack.pages ?? []).map((p: any) => p.name);
    expect(pageNames).toContain('showcase_page_variables');

    // Navigation has a link to the page.
    const flat = JSON.stringify(ShowcaseApp.navigation ?? []);
    expect(flat).toContain('showcase_page_variables');
  });
});
