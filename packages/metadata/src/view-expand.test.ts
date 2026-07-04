// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { expandViewContainer, isAggregatedViewContainer } from './plugin.js';

// Mirrors examples/app-crm/src/views/lead.view.ts — the canonical case where
// the default `list` and `listViews.all` are structurally identical (the
// original "All Leads" duplicate).
const leadContainer = {
  list: {
    label: 'All Leads',
    type: 'grid',
    data: { provider: 'object', object: 'crm_lead' },
    columns: [{ field: 'name' }, { field: 'company' }],
  },
  listViews: {
    all: {
      label: 'All Leads',
      type: 'grid',
      data: { provider: 'object', object: 'crm_lead' },
      columns: [{ field: 'name' }, { field: 'company' }],
    },
    pipeline: {
      label: 'Lead Pipeline (Kanban)',
      type: 'kanban',
      data: { provider: 'object', object: 'crm_lead' },
      columns: ['name', 'company'],
      kanban: { groupByField: 'status' },
    },
  },
  formViews: {
    default: { type: 'simple', sections: [{ label: 'Info', fields: [{ field: 'name' }] }] },
  },
};

describe('isAggregatedViewContainer', () => {
  it('detects aggregated containers', () => {
    expect(isAggregatedViewContainer(leadContainer)).toBe(true);
    expect(isAggregatedViewContainer({ list: {} })).toBe(true);
  });
  it('rejects already-independent ViewItems', () => {
    expect(isAggregatedViewContainer({ viewKind: 'list', name: 'a.b', object: 'a', config: {} })).toBe(false);
  });
  it('rejects non-objects', () => {
    expect(isAggregatedViewContainer(null)).toBe(false);
    expect(isAggregatedViewContainer('x')).toBe(false);
    expect(isAggregatedViewContainer({})).toBe(false);
  });
});

describe('expandViewContainer', () => {
  const items = expandViewContainer('crm_lead', leadContainer);
  const byName = Object.fromEntries(items.map((i) => [i.name, i]));

  it('collapses the duplicate "All Leads" (list == listViews.all) into one item', () => {
    const listItems = items.filter((i) => i.viewKind === 'list');
    // Only `all` and `pipeline` — the default `list` is deduped into `all`.
    expect(listItems.map((i) => i.name).sort()).toEqual(['crm_lead.all', 'crm_lead.pipeline']);
  });

  it('produces qualified <object>.<key> names', () => {
    expect(byName['crm_lead.all']).toBeTruthy();
    expect(byName['crm_lead.pipeline']).toBeTruthy();
    expect(byName['crm_lead.default']).toBeTruthy();
  });

  it('binds every item to its object and stamps scope=package', () => {
    for (const i of items) {
      expect(i.object).toBe('crm_lead');
      expect(i.scope).toBe('package');
    }
  });

  it('flags the declared default list view (matching `list`) as isDefault', () => {
    expect(byName['crm_lead.all'].isDefault).toBe(true);
    expect(byName['crm_lead.pipeline'].isDefault).toBeFalsy();
  });

  it('preserves view kind and config (kanban sub-config survives)', () => {
    expect(byName['crm_lead.pipeline'].viewKind).toBe('list');
    expect(byName['crm_lead.pipeline'].config.type).toBe('kanban');
    expect(byName['crm_lead.pipeline'].config.kanban.groupByField).toBe('status');
    expect(byName['crm_lead.default'].viewKind).toBe('form');
  });

  it('clones config (no shared reference with the container)', () => {
    expect(byName['crm_lead.pipeline'].config).not.toBe(leadContainer.listViews.pipeline);
  });

  it('assigns a stable order', () => {
    const orders = items.map((i) => i.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});

describe('expandViewContainer — default list with no listViews dup', () => {
  it('emits the default list as <object>.default when unique', () => {
    const items = expandViewContainer('acct', {
      list: { type: 'grid', label: 'Accounts', columns: ['name'], data: { provider: 'object', object: 'acct' } },
    });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('acct.default');
    expect(items[0].isDefault).toBe(true);
  });
});

describe('expandViewContainer — name collisions carry _diagnostics warnings (#2554)', () => {
  it('warns when formViews.default collides with the implicit default list', () => {
    const items = expandViewContainer('task', {
      list: { type: 'grid', label: 'All Tasks', columns: ['title'], data: { provider: 'object', object: 'task' } },
      formViews: {
        default: { type: 'simple', data: { provider: 'object', object: 'task' }, sections: [] },
      },
    });
    const list = items.find((i) => i.viewKind === 'list');
    const form = items.find((i) => i.viewKind === 'form');
    // Rename behaviour itself is unchanged (backward compat)…
    expect(list?.name).toBe('task.default');
    expect(form?.name).toBe('task.default_2');
    // …but the renamed item now carries a loud, machine-readable warning.
    expect(list?._diagnostics).toBeUndefined();
    expect(form?._diagnostics?.valid).toBe(true);
    expect(form?._diagnostics?.warnings).toHaveLength(1);
    expect(form?._diagnostics?.warnings[0].path).toBe('name');
    expect(form?._diagnostics?.warnings[0].message).toContain("'task.default'");
    expect(form?._diagnostics?.warnings[0].message).toContain("'task.default_2'");
  });

  it('warns when a formViews key collides with a listViews key', () => {
    const items = expandViewContainer('task', {
      listViews: {
        mine: { type: 'grid', label: 'Mine', columns: ['title'], data: { provider: 'object', object: 'task' } },
      },
      formViews: {
        mine: { type: 'simple', data: { provider: 'object', object: 'task' }, sections: [] },
      },
    });
    const form = items.find((i) => i.viewKind === 'form');
    expect(form?.name).toBe('task.mine_2');
    expect(form?._diagnostics?.warnings?.[0].message).toContain("'task.mine'");
  });

  it('does not stamp _diagnostics on collision-free expansions', () => {
    const items = expandViewContainer('task', {
      list: { type: 'grid', label: 'All', columns: ['title'], data: { provider: 'object', object: 'task' } },
      formViews: {
        edit: { type: 'simple', data: { provider: 'object', object: 'task' }, sections: [] },
      },
    });
    expect(items).toHaveLength(2);
    for (const item of items) expect(item._diagnostics).toBeUndefined();
  });
});
