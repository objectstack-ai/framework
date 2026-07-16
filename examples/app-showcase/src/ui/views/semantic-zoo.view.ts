// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { defineView } from '@objectstack/spec';

/**
 * Semantic-zoo kanban views — runtime dogfood for the ADR-0085 `stageField`
 * role driving DEFAULT kanban lanes (objectui#2596).
 *
 * Both boards deliberately omit the `kanban` binding (it is optional on the
 * view schema): with no explicit `groupByField`, the lane field resolves
 * through the shared `detectStatusField` semantics —
 *
 *  - `showcase_semantic_zoo` declares `stageField: 'status'` → the board
 *    lanes by Draft / Active / Done with zero view-level config;
 *  - `showcase_semantic_zoo_legacy` declares `stageField: false` (its
 *    `status` is a color, not a lifecycle) → NO default lanes: the board
 *    renders its empty state instead of grouping by Red / Green, which is
 *    exactly what the pre-#2596 hard-coded 'status' fallback used to do.
 *
 * Guarded by `examples/app-showcase/e2e/detail-shapes.spec.ts`.
 */
export const SemanticZooViews = defineView({
  board: {
    label: 'Board (lanes from stageField)',
    type: 'kanban',
    data: { provider: 'object' as const, object: 'showcase_semantic_zoo' },
    columns: ['name', 'code', 'amount'],
  },
});

export const SemanticZooLegacyViews = defineView({
  board: {
    label: 'Board (no lanes by design)',
    type: 'kanban',
    data: { provider: 'object' as const, object: 'showcase_semantic_zoo_legacy' },
    columns: ['name', 'amount'],
  },
});
