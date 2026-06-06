import { describe, expect, it } from 'vitest';
import { lintDataModel } from '../src/lint/data-model-rules';
import { lintConfig } from '../src/commands/lint';

const rulesOf = (issues: { rule: string }[]) => issues.map((i) => i.rule);
const has = (issues: { rule: string }[], rule: string) => rulesOf(issues).includes(rule);

describe('lintDataModel — relationships', () => {
  it('returns [] for empty input', () => {
    expect(lintDataModel([])).toEqual([]);
    expect(lintDataModel(undefined as any)).toEqual([]);
  });

  it('flags a relationship field missing a reference (error)', () => {
    const issues = lintDataModel([
      { name: 'task', fields: { project: { type: 'master_detail', required: true } } },
    ]);
    const issue = issues.find((i) => i.rule === 'relationship/missing-reference');
    expect(issue?.severity).toBe('error');
  });

  it('warns when a master_detail is not required', () => {
    const issues = lintDataModel([
      { name: 'invoice', fields: { number: { type: 'text' } } },
      { name: 'invoice_line', fields: { invoice: { type: 'master_detail', reference: 'invoice', required: true, deleteBehavior: 'cascade' } } },
    ]);
    expect(has(issues, 'relationship/master-detail-required')).toBe(false);

    const issues2 = lintDataModel([
      { name: 'invoice_line', fields: { invoice: { type: 'master_detail', reference: 'invoice', deleteBehavior: 'cascade' } } },
    ]);
    const req = issues2.find((i) => i.rule === 'relationship/master-detail-required');
    expect(req?.severity).toBe('warning');
  });

  it('suggests an explicit deleteBehavior on master_detail', () => {
    const issues = lintDataModel([
      { name: 'invoice_line', fields: { invoice: { type: 'master_detail', reference: 'invoice', required: true } } },
    ]);
    const db = issues.find((i) => i.rule === 'relationship/delete-behavior');
    expect(db?.severity).toBe('suggestion');
  });

  it('suggests inlineEdit on master_detail line-item children', () => {
    const issues = lintDataModel([
      { name: 'order_line', fields: { order: { type: 'master_detail', reference: 'order', required: true, deleteBehavior: 'cascade' } } },
    ]);
    expect(has(issues, 'relationship/line-items-inline-edit')).toBe(true);
  });

  it('does NOT suggest inlineEdit when already set', () => {
    const issues = lintDataModel([
      { name: 'order_line', fields: { order: { type: 'master_detail', reference: 'order', required: true, deleteBehavior: 'cascade', inlineEdit: true } } },
    ]);
    expect(has(issues, 'relationship/line-items-inline-edit')).toBe(false);
  });

  it('suggests master_detail when a line-item child uses lookup', () => {
    const issues = lintDataModel([
      { name: 'quote_item', fields: { quote: { type: 'lookup', reference: 'quote' } } },
    ]);
    expect(has(issues, 'relationship/line-item-should-be-master-detail')).toBe(true);
  });

  it('warns when an association child is inlineEdit', () => {
    const issues = lintDataModel([
      { name: 'ticket_comment', fields: { ticket: { type: 'master_detail', reference: 'ticket', required: true, deleteBehavior: 'cascade', inlineEdit: true } } },
    ]);
    const assoc = issues.find((i) => i.rule === 'relationship/association-inline-edit');
    expect(assoc?.severity).toBe('warning');
  });

  it('does NOT treat a line-item child as an association', () => {
    const issues = lintDataModel([
      { name: 'invoice_line', fields: { invoice: { type: 'master_detail', reference: 'invoice', required: true, deleteBehavior: 'cascade', inlineEdit: true } } },
    ]);
    expect(has(issues, 'relationship/association-inline-edit')).toBe(false);
  });
});

describe('lintDataModel — roll-ups', () => {
  it('suggests a roll-up when a parent owns master_detail children with numeric fields', () => {
    const issues = lintDataModel([
      { name: 'invoice', label: 'Invoice', fields: { number: { type: 'text' } } },
      { name: 'invoice_line', fields: { invoice: { type: 'master_detail', reference: 'invoice', required: true, deleteBehavior: 'cascade' }, amount: { type: 'currency' } } },
    ]);
    expect(has(issues, 'rollup/missing-summary')).toBe(true);
  });

  it('does NOT suggest a roll-up when a summary already aggregates that child', () => {
    const issues = lintDataModel([
      {
        name: 'invoice',
        fields: {
          number: { type: 'text' },
          total: { type: 'summary', summaryOperations: { object: 'invoice_line', field: 'amount', function: 'sum' } },
        },
      },
      { name: 'invoice_line', fields: { invoice: { type: 'master_detail', reference: 'invoice', required: true, deleteBehavior: 'cascade' }, amount: { type: 'currency' } } },
    ]);
    expect(has(issues, 'rollup/missing-summary')).toBe(false);
  });

  it('does NOT suggest a roll-up for a child with no numeric field', () => {
    const issues = lintDataModel([
      { name: 'project', fields: { name: { type: 'text' } } },
      { name: 'project_note', fields: { project: { type: 'master_detail', reference: 'project', required: true, deleteBehavior: 'cascade' }, body: { type: 'textarea' } } },
    ]);
    expect(has(issues, 'rollup/missing-summary')).toBe(false);
  });
});

describe('lintDataModel — fields & objects', () => {
  it('warns on a select field with no options', () => {
    const issues = lintDataModel([
      { name: 'task', fields: { status: { type: 'select' } } },
    ]);
    const sel = issues.find((i) => i.rule === 'field/select-missing-options');
    expect(sel?.severity).toBe('warning');
  });

  it('accepts a select with options or an options source', () => {
    const withOptions = lintDataModel([
      { name: 'task', fields: { status: { type: 'select', options: [{ label: 'Open', value: 'open' }] } } },
    ]);
    expect(has(withOptions, 'field/select-missing-options')).toBe(false);
  });

  it('suggests a name field when an object has none', () => {
    const issues = lintDataModel([
      { name: 'widget', fields: { color: { type: 'text' }, size: { type: 'number' } } },
    ]);
    expect(has(issues, 'object/missing-name-field')).toBe(true);
  });

  it('accepts an object with a name field or primaryField', () => {
    expect(has(lintDataModel([{ name: 'a', fields: { name: { type: 'text' } } }]), 'object/missing-name-field')).toBe(false);
    expect(has(lintDataModel([{ name: 'b', primaryField: 'code', fields: { code: { type: 'text' } } }]), 'object/missing-name-field')).toBe(false);
  });

  it('handles array-shaped fields', () => {
    const issues = lintDataModel([
      { name: 'invoice_line', fields: [{ name: 'invoice', type: 'master_detail', reference: 'invoice' }] },
    ]);
    expect(has(issues, 'relationship/master-detail-required')).toBe(true);
  });
});

describe('lintConfig integration', () => {
  it('a clean invoice/line model produces no data-model errors or warnings', () => {
    const issues = lintConfig({
      objects: [
        {
          name: 'invoice',
          label: 'Invoice',
          fields: {
            number: { type: 'text', label: 'Number' },
            total: { type: 'summary', label: 'Total', summaryOperations: { object: 'invoice_line', field: 'amount', function: 'sum' } },
          },
        },
        {
          name: 'invoice_line',
          label: 'Invoice Line',
          fields: {
            invoice: { type: 'master_detail', label: 'Invoice', reference: 'invoice', required: true, deleteBehavior: 'cascade', inlineEdit: true },
            product: { type: 'text', label: 'Product' },
            amount: { type: 'currency', label: 'Amount' },
          },
        },
      ],
    });
    const dataModel = issues.filter((i) => i.rule.startsWith('relationship/') || i.rule.startsWith('rollup/') || i.rule.startsWith('field/') || i.rule.startsWith('object/'));
    expect(dataModel.filter((i) => i.severity !== 'suggestion')).toEqual([]);
  });
});
