// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Page } from '@objectstack/spec/ui';

/**
 * My Work — a role-aware workspace home that *composes* live data the way a
 * real landing page does, instead of listing one component per type:
 *   • a KPI hero row of live `object-metric` tiles (team throughput);
 *   • a personal work queue — `object-grid` filtered to the signed-in user
 *     via the `{current_user_id}` token (records I own);
 *   • a role-gated card (`visible` expression) that only the admin sees —
 *     demonstrating per-user differentiated rendering.
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
        // KPI hero row — live aggregates over the team's work.
        { type: 'object-metric', properties: { objectName: 'showcase_task', label: 'Open Tasks', icon: 'list-checks', aggregate: { field: 'id', function: 'count' }, filter: { status: { $ne: 'done' } } } },
        { type: 'object-metric', properties: { objectName: 'showcase_task', label: 'In Review', icon: 'eye', aggregate: { field: 'id', function: 'count' }, filter: { status: 'in_review' } } },
        { type: 'object-metric', properties: { objectName: 'showcase_project', label: 'At-Risk Projects', icon: 'alert-triangle', aggregate: { field: 'id', function: 'count' }, filter: { health: 'red' } } },
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
        // Role-gated: only the admin sees this card — differentiated rendering.
        {
          type: 'page:card',
          properties: { title: 'Leadership View', visible: "current_user.email == 'admin@objectos.ai'" },
        },
        { type: 'element:text', properties: { content: 'Tip: open Delivery Operations for the org-wide dashboard.' } },
      ],
    },
  ],
};
