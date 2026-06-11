// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Build-time dashboard widget binding diagnostics (issue #1719).
 *
 * Runs at `objectstack compile`/`build` AFTER the stack has been schema-parsed,
 * so every widget's `dataset` reference can be linked to its `defineDataset`
 * and each entry in `values` resolved to a concrete measure with a known
 * `aggregate`. This is the semantic/cross-reference phase — the rules here
 * cannot run during plain Zod parsing of the raw widget literal.
 *
 * Rule `table-count-only`: a `table` / `pivot` widget whose selected measures
 * are ALL `aggregate: 'count'` and which declares no `dimensions` asks the
 * analytics service for a single summary row. That is the shape a `metric`
 * widget wants — for a table it almost always means the author wanted a
 * per-record listing, which is not an analytics dataset at all (model it as an
 * object-bound ListView, ADR-0017). The signal is evaluated on the WIDGET's
 * binding, not the dataset: a dataset may well carry other measures and
 * dimensions the widget simply doesn't select.
 *
 * Warnings are non-fatal by design — `objectstack build` stays green — and a
 * deliberate single-row table can opt out per widget via
 * `suppressWarnings: ['table-count-only']`.
 */

export const TABLE_COUNT_ONLY = 'table-count-only';

export interface WidgetBindingWarning {
  /** Diagnostic rule id (registry entry), e.g. `table-count-only`. */
  rule: string;
  /** Human-readable location, e.g. `dashboard "x" › widget "y"`. */
  where: string;
  /** Config path, e.g. `dashboards[0].widgets[3]`. */
  path: string;
  /** What is wrong. */
  message: string;
  /** How to fix (or deliberately suppress) it. */
  hint: string;
}

type AnyRec = Record<string, unknown>;

/** Coerce a collection (array or name-keyed map) to an array. */
function asArray(v: unknown): AnyRec[] {
  if (Array.isArray(v)) return v as AnyRec[];
  if (v && typeof v === 'object') {
    return Object.entries(v as AnyRec).map(([name, def]) => ({ name, ...(def as AnyRec) }));
  }
  return [];
}

/**
 * Validate every dashboard widget's dataset binding. Returns the list of
 * warnings (empty = clean). Caller decides how to surface them — these are
 * advisory and must never fail the build on their own.
 */
export function validateWidgetBindings(stack: AnyRec): WidgetBindingWarning[] {
  const warnings: WidgetBindingWarning[] = [];

  const datasets = new Map<string, AnyRec>();
  for (const ds of asArray(stack.datasets)) {
    if (typeof ds.name === 'string') datasets.set(ds.name, ds);
  }

  const dashboards = asArray(stack.dashboards);
  for (let i = 0; i < dashboards.length; i++) {
    const dash = dashboards[i];
    const dashName = typeof dash.name === 'string' ? dash.name : `(dashboard ${i})`;
    const widgets = Array.isArray(dash.widgets) ? (dash.widgets as AnyRec[]) : [];

    for (let j = 0; j < widgets.length; j++) {
      const w = widgets[j];
      if (w.type !== 'table' && w.type !== 'pivot') continue;
      // Grouped by at least one dimension → genuinely aggregated rows.
      if (Array.isArray(w.dimensions) && w.dimensions.length > 0) continue;
      // Author opted out — a single-row summary table is intentional here.
      if (Array.isArray(w.suppressWarnings) && w.suppressWarnings.includes(TABLE_COUNT_ONLY)) continue;

      const dsName = typeof w.dataset === 'string' ? w.dataset : undefined;
      const dataset = dsName ? datasets.get(dsName) : undefined;
      // A dangling dataset reference is a cross-reference finding, not this rule.
      if (!dataset) continue;

      const measures = new Map<string, AnyRec>();
      for (const m of asArray(dataset.measures)) {
        if (typeof m.name === 'string') measures.set(m.name, m);
      }

      const values = Array.isArray(w.values)
        ? (w.values as unknown[]).filter((v): v is string => typeof v === 'string')
        : [];
      if (values.length === 0) continue;
      const resolved = values.map((v) => measures.get(v));
      // An unresolvable measure name is a different diagnostic — don't guess.
      if (resolved.some((m) => !m)) continue;

      // Derived measures combine other measures; treat them as non-count even
      // when their (ignored) `aggregate` says otherwise.
      const countOnly = resolved.every((m) => m!.aggregate === 'count' && !m!.derived);
      if (!countOnly) continue;

      const widgetId = typeof w.id === 'string' ? w.id : `(widget ${j})`;
      warnings.push({
        rule: TABLE_COUNT_ONLY,
        where: `dashboard "${dashName}" › widget "${widgetId}"`,
        path: `dashboards[${i}].widgets[${j}]`,
        message:
          `a '${w.type}' widget bound to dataset "${dsName}" selects only count ` +
          `measure(s) (${values.join(', ')}) and no dimensions, so it renders a ` +
          `single summary row — not a per-record list.`,
        hint:
          `A flat record listing is not an analytics dataset. Model it as an ` +
          `object-bound ListView (ADR-0017) surfaced through app navigation, and ` +
          `use a 'metric' widget here if you only need the count. If a single-row ` +
          `table is intentional, add an explicit dimension or suppress with: ` +
          `suppressWarnings: ['${TABLE_COUNT_ONLY}']`,
      });
    }
  }

  return warnings;
}
