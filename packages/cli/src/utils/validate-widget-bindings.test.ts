import { describe, it, expect } from 'vitest';
import { validateWidgetBindings, TABLE_COUNT_ONLY } from './validate-widget-bindings.js';

/** The downstream repro from issue #1719 — dataset with a count AND a sum
 *  measure plus a dimension; the widget selects only the count, no dims. */
function reproStack(widgetOverrides: Record<string, unknown> = {}) {
  return {
    datasets: [{
      name: 'expense_report_metrics',
      label: 'Expense report metrics',
      object: 'expense_report',
      measures: [
        { name: 'report_count', label: 'report_count', aggregate: 'count' },
        { name: 'total_amount', label: 'total_amount', aggregate: 'sum', field: 'total_amount' },
      ],
      dimensions: [{ name: 'cost_center', field: 'cost_center' }],
    }],
    dashboards: [{
      name: 'expenses_overview_dashboard',
      label: 'Expenses Overview',
      widgets: [{
        id: 'pending_reports_table',
        type: 'table',
        dataset: 'expense_report_metrics',
        values: ['report_count'],
        filter: { status: 'submitted' },
        layout: { x: 0, y: 0, w: 6, h: 4 },
        ...widgetOverrides,
      }],
    }],
  };
}

describe('validateWidgetBindings (table-count-only, issue #1719)', () => {
  it('warns on the issue repro: count-only table widget without dimensions', () => {
    const warnings = validateWidgetBindings(reproStack());
    expect(warnings).toHaveLength(1);
    expect(warnings[0].rule).toBe(TABLE_COUNT_ONLY);
    expect(warnings[0].where).toContain('expenses_overview_dashboard');
    expect(warnings[0].where).toContain('pending_reports_table');
    expect(warnings[0].path).toBe('dashboards[0].widgets[0]');
    expect(warnings[0].message).toContain('report_count');
    expect(warnings[0].message).toContain('single summary row');
    expect(warnings[0].hint).toContain('ListView (ADR-0017)');
    expect(warnings[0].hint).toContain(`suppressWarnings: ['${TABLE_COUNT_ONLY}']`);
  });

  it('warns for pivot widgets too', () => {
    const warnings = validateWidgetBindings(reproStack({ type: 'pivot' }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("'pivot' widget");
  });

  it('is keyed on the WIDGET binding — selecting the sum measure is clean', () => {
    expect(validateWidgetBindings(reproStack({ values: ['total_amount'] }))).toHaveLength(0);
  });

  it('mixed count + non-count selection is clean', () => {
    expect(validateWidgetBindings(reproStack({ values: ['report_count', 'total_amount'] }))).toHaveLength(0);
  });

  it('declaring a dimension on the widget is clean', () => {
    expect(validateWidgetBindings(reproStack({ dimensions: ['cost_center'] }))).toHaveLength(0);
  });

  it('metric widgets are exactly what a count-only binding wants — clean', () => {
    expect(validateWidgetBindings(reproStack({ type: 'metric' }))).toHaveLength(0);
  });

  it('suppressWarnings opts a deliberate single-row table out', () => {
    expect(validateWidgetBindings(reproStack({ suppressWarnings: [TABLE_COUNT_ONLY] }))).toHaveLength(0);
  });

  it('unrelated suppressWarnings entries do not suppress', () => {
    expect(validateWidgetBindings(reproStack({ suppressWarnings: ['some-other-rule'] }))).toHaveLength(1);
  });

  it('skips dangling dataset references (cross-reference finding, not this rule)', () => {
    expect(validateWidgetBindings(reproStack({ dataset: 'no_such_dataset' }))).toHaveLength(0);
  });

  it('skips unresolvable measure names (a different diagnostic)', () => {
    expect(validateWidgetBindings(reproStack({ values: ['no_such_measure'] }))).toHaveLength(0);
  });

  it('treats derived measures as non-count even when aggregate says count', () => {
    const stack = reproStack({ values: ['count_ratio'] });
    (stack.datasets[0].measures as Record<string, unknown>[]).push({
      name: 'count_ratio',
      aggregate: 'count',
      derived: { op: 'ratio', of: ['report_count', 'report_count'] },
    });
    expect(validateWidgetBindings(stack)).toHaveLength(0);
  });

  it('count_distinct is a deliberate analytic — clean', () => {
    const stack = reproStack({ values: ['unique_requesters'] });
    (stack.datasets[0].measures as Record<string, unknown>[]).push({
      name: 'unique_requesters',
      aggregate: 'count_distinct',
      field: 'requester',
    });
    expect(validateWidgetBindings(stack)).toHaveLength(0);
  });

  it('handles map-keyed datasets/dashboards collections', () => {
    const arrayForm = reproStack();
    const { name: _dsName, ...dsRest } = arrayForm.datasets[0];
    const { name: _dashName, ...dashRest } = arrayForm.dashboards[0];
    const stack = {
      datasets: { expense_report_metrics: dsRest },
      dashboards: { expenses_overview_dashboard: dashRest },
    };
    const warnings = validateWidgetBindings(stack);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].where).toContain('expenses_overview_dashboard');
  });

  it('is silent on stacks without dashboards or datasets', () => {
    expect(validateWidgetBindings({})).toHaveLength(0);
    expect(validateWidgetBindings({ dashboards: [], datasets: [] })).toHaveLength(0);
  });
});
