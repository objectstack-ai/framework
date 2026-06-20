// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Page } from '@objectstack/spec/ui';

/**
 * My Work — a role-aware workspace home that *composes* live data the way a
 * real landing page does, instead of listing one component per type:
 *   • a KPI hero row of live `object-metric` tiles (team throughput);
 *   • a personal work queue — `object-grid` filtered to the signed-in user
 *     via the `{current_user_id}` token (records I own);
 *   • a sidebar Shortcuts card pointing at the key surfaces.
 *
 * (Note: page-component `visible` expressions don't receive a `current_user`
 * context in the renderer, so true per-role gating belongs in object/field
 * permissions + sharing rules, not a card-level expression.)
 */
export const MyWorkPage: Page = {
  name: 'showcase_my_work',
  label: 'My Work',
  type: 'home',
  template: 'header-sidebar-main',
  isDefault: false,
  kind: 'full',
  regions: [
    {
      name: 'header',
      width: 'full',
      components: [
        { type: 'page:header', properties: { title: 'My Work', subtitle: 'Your queue, the team’s throughput, and what needs attention.' } },
      ],
    },
    {
      name: 'main',
      width: 'large',
      components: [
        // KPI hero ROW — three live tiles laid out horizontally via a grid.
        {
          type: 'flex',
          properties: {
            direction: 'row',
            wrap: true,
            gap: 4,
            align: 'stretch',
            children: [
              { type: 'object-metric', properties: { objectName: 'showcase_task', label: 'Open Tasks', icon: 'list-checks', aggregate: { field: 'id', function: 'count' }, filter: { status: { $ne: 'done' } } } },
              { type: 'object-metric', properties: { objectName: 'showcase_task', label: 'In Review', icon: 'eye', aggregate: { field: 'id', function: 'count' }, filter: { status: 'in_review' } } },
              { type: 'object-metric', properties: { objectName: 'showcase_project', label: 'At-Risk Projects', icon: 'alert-triangle', aggregate: { field: 'id', function: 'count' }, filter: { health: 'red' } } },
            ],
          },
        },
        { type: 'element:divider', properties: {} },
        // Personal work queue — records owned by the signed-in user.
        {
          type: 'object-grid',
          properties: {
            objectName: 'showcase_task',
            columns: ['title', 'project', 'status', 'priority', 'due_date'],
            filters: [['owner_id', '=', '{current_user_id}']],
          },
        },
      ],
    },
    {
      name: 'sidebar',
      width: 'small',
      components: [
        // Sidebar shortcuts — plain text lines (region containers don't render
        // nested page:card bodies; direct components are the reliable path).
        { type: 'element:text', properties: { content: 'Shortcuts' } },
        { type: 'element:text', properties: { content: '• Delivery Operations — the org-wide KPI dashboard.' } },
        { type: 'element:text', properties: { content: '• Approvals — items in review awaiting a decision.' } },
        { type: 'element:text', properties: { content: '• New Project (Wizard) — create a project step by step.' } },
      ],
    },
  ],
};
