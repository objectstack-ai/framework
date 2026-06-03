import { describe, expect, it } from 'vitest';
import { lintConfig } from '../src/commands/lint';

describe('lint view labels', () => {
  it('accepts canonical default list labels', () => {
    const issues = lintConfig({
      views: [
        {
          list: {
            label: 'Accounts',
            columns: ['name'],
          },
        },
      ],
    });

    expect(issues.filter((issue) => issue.rule === 'required/label')).toEqual([]);
  });

  it('accepts canonical named list view labels', () => {
    const issues = lintConfig({
      views: [
        {
          listViews: {
            all: {
              label: 'All Accounts',
              columns: ['name'],
            },
          },
        },
      ],
    });

    expect(issues.filter((issue) => issue.rule === 'required/label')).toEqual([]);
  });

  it('reports a missing label at the schema-supported list label path', () => {
    const issues = lintConfig({
      views: [
        {
          list: {
            columns: ['name'],
          },
        },
      ],
    });

    expect(issues).toContainEqual(expect.objectContaining({
      rule: 'required/label',
      path: 'views[0].list.label',
      message: 'View "?" is missing a label',
    }));
  });
});
