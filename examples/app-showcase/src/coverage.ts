// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Coverage manifest — the soul of the showcase.
 *
 * This module declares *what the showcase is supposed to cover* and provides
 * the helpers the coverage test uses to prove it. The test (see
 * `test/coverage.test.ts`) introspects the protocol's own contracts at TWO
 * levels and asserts the showcase keeps up with both:
 *
 *   • Kind level — `DEFAULT_METADATA_TYPE_REGISTRY` (the definitive list of
 *     metadata kinds). Every kind must be either `demonstrated` (with the
 *     files that prove it) or explicitly `waived` (with a reason and a
 *     GitHub issue). A new registry kind fails CI until it is accounted for,
 *     and a silently-dropped demo fails the file-existence check. No kind
 *     can go missing without leaving a paper trail (Prime Directive #10:
 *     never advertise a capability the runtime doesn't deliver — and never
 *     let a gap hide).
 *
 *   • Variant level — the spec's own Zod enums (`FieldTypeSchema`,
 *     `ChartTypeSchema`, `ReportType`, `ActionType`, `ACTION_LOCATIONS`).
 *     Every member must appear at least once across the registered metadata.
 *
 * Because the expected sets come from the *spec*, the tests fail
 * automatically when the platform gains a new kind, field type, chart type,
 * or report type that the showcase has not yet demonstrated — keeping this
 * example a living conformance fixture, not a static snapshot.
 */

import type { MetadataType } from '@objectstack/spec/kernel';

/**
 * Kind-level coverage entry: either the showcase demonstrates the kind (and
 * `files` point at the proof, relative to the package root), or it is waived
 * with a reason and the GitHub issue that tracks closing the gap.
 */
export type KindCoverage =
  | { status: 'demonstrated'; files: string[]; notes?: string }
  | { status: 'waived'; reason: string; issue: string };

const ISSUE = {
  aiDeferred: 'https://github.com/objectstack-ai/framework/issues/2610',
  noAuthoringSurface: 'https://github.com/objectstack-ai/framework/issues/2613',
} as const;

/**
 * Every metadata kind in `DEFAULT_METADATA_TYPE_REGISTRY`, accounted for.
 * The coverage test enumerates the registry and fails on any kind missing
 * here (new platform kind) or any entry the registry no longer knows
 * (stale manifest).
 */
export const KIND_COVERAGE: Record<MetadataType, KindCoverage> = {
  // ── data ──
  object: {
    status: 'demonstrated',
    files: ['src/data/objects/index.ts', 'src/data/objects/field-zoo.object.ts'],
  },
  field: {
    status: 'demonstrated',
    files: ['src/data/objects/field-zoo.object.ts'],
    notes:
      'FieldSchema is authored inline on objects (the stack DSL has no standalone `fields` collection); field-zoo exhausts every field type — see the variant-level test.',
  },
  trigger: {
    status: 'waived',
    reason:
      'No declarative authoring surface: no stack collection or defineTrigger helper. Record-change triggering is demonstrated behaviorally by the record-change flows (requires: ["triggers"]).',
    issue: ISSUE.noAuthoringSurface,
  },
  validation: {
    status: 'demonstrated',
    files: ['src/data/objects/account.object.ts', 'src/data/objects/task.object.ts'],
    notes:
      'Authored inline via object `validations`. Only the runtime-enforced rule types (state_machine/script/cross_field) are demonstrated; the 6 unenforced types are tracked in https://github.com/objectstack-ai/framework/issues/1475 (Prime Directive #10).',
  },
  hook: { status: 'demonstrated', files: ['src/data/hooks/index.ts'] },
  seed: { status: 'demonstrated', files: ['src/data/seed/index.ts'] },

  // ── ui ──
  view: { status: 'demonstrated', files: ['src/ui/views/task.view.ts', 'src/ui/views/project.view.ts'] },
  page: { status: 'demonstrated', files: ['src/ui/pages/index.ts'] },
  dashboard: { status: 'demonstrated', files: ['src/ui/dashboards/chart-gallery.dashboard.ts'] },
  app: { status: 'demonstrated', files: ['src/ui/apps/index.ts'] },
  action: { status: 'demonstrated', files: ['src/ui/actions/index.ts'] },
  report: { status: 'demonstrated', files: ['src/ui/reports/index.ts'] },
  dataset: { status: 'demonstrated', files: ['src/ui/datasets/index.ts'] },

  // ── automation ──
  flow: { status: 'demonstrated', files: ['src/automation/flows/index.ts'] },
  job: { status: 'demonstrated', files: ['src/automation/jobs/index.ts'] },

  // ── system ──
  datasource: {
    status: 'demonstrated',
    files: ['src/system/datasources/showcase-external.datasource.ts'],
  },
  external_catalog: {
    status: 'waived',
    reason:
      'Runtime-created via Setup → Datasources → Sync (ADR-0062); no declarative artifact an app package can ship. The showcase demos the federation flow that produces one.',
    issue: ISSUE.noAuthoringSurface,
  },
  translation: { status: 'demonstrated', files: ['src/system/translations/index.ts'] },
  router: {
    status: 'waived',
    reason:
      'Code-only (allowRuntimeCreate: false). The code-level equivalent is the imperative HTTP mount in src/system/server/recalc-endpoint.ts.',
    issue: ISSUE.noAuthoringSurface,
  },
  function: {
    status: 'waived',
    reason: 'Code-only (allowRuntimeCreate: false); no declarative authoring surface.',
    issue: ISSUE.noAuthoringSurface,
  },
  service: {
    status: 'waived',
    reason: 'Code-only (allowRuntimeCreate: false); no declarative authoring surface.',
    issue: ISSUE.noAuthoringSurface,
  },
  email_template: { status: 'demonstrated', files: ['src/system/emails/index.ts'] },
  doc: {
    status: 'demonstrated',
    files: ['src/docs/showcase_index.md', 'src/docs/showcase_tour_data.md'],
    notes: 'Includes the five per-domain guided-tour docs (showcase_tour_*) with live metadata embeds (ADR-0051).',
  },
  book: {
    status: 'demonstrated',
    files: ['src/system/books/index.ts'],
    notes: 'ShowcaseBook curates a Guided Tour group in fixed domain order.',
  },

  // ── security ──
  permission: { status: 'demonstrated', files: ['src/security/index.ts'] },
  profile: {
    status: 'demonstrated',
    files: ['src/security/index.ts'],
    notes: 'MemberDefaultProfile — a permission set with isProfile: true (ADR-0056 D7).',
  },
  role: { status: 'demonstrated', files: ['src/security/index.ts'] },

  // ── ai ──
  agent: {
    status: 'waived',
    reason:
      'Agents are platform-owned — the kernel ships exactly ask/build and third parties never author *.agent.ts (ADR-0063). The in-UI AI runtime is cloud-only; the open framework exposes AI via @objectstack/mcp.',
    issue: ISSUE.aiDeferred,
  },
  tool: {
    status: 'waived',
    reason:
      'Deferred with the AI examples iteration — tools are the third-party AI extension primitive (ADR-0063) and belong here once the BYO-AI (MCP) verification story is worked out.',
    issue: ISSUE.aiDeferred,
  },
  skill: {
    status: 'waived',
    reason:
      'Deferred with the AI examples iteration — skills are the third-party AI extension primitive (ADR-0063) and belong here once the BYO-AI (MCP) verification story is worked out.',
    issue: ISSUE.aiDeferred,
  },
};

/**
 * Stack collections that are not registry kinds but that the showcase tracks
 * for ≥ app-crm parity. Same demonstrated-or-waived contract as
 * `KIND_COVERAGE`.
 */
export const STACK_COLLECTION_COVERAGE: Record<string, KindCoverage> = {
  analyticsCubes: {
    status: 'demonstrated',
    files: ['src/data/analytics/showcase.cube.ts'],
    notes:
      'Served by the foundational analytics capability (/api/v1/analytics/*); complements the dataset semantic layer (ADR-0021).',
  },
  objectExtensions: {
    status: 'demonstrated',
    files: ['src/data/extensions/account.extension.ts'],
    notes: 'Merged into showcase_account by the ObjectQL engine at registerApp (priority overlay).',
  },
  mappings: {
    status: 'waived',
    reason:
      'defineMapping artifacts are registered but never consumed — the REST import path only accepts an inline per-request mapping, so a stack-level mapping is inert.',
    issue: 'https://github.com/objectstack-ai/framework/issues/2611',
  },
  connectors: {
    status: 'waived',
    reason:
      'Declarative connectors: entries never reach the automation connector registry (plugin registerConnector only). Live connectors are demonstrated the delivered way: ConnectorRestPlugin/ConnectorSlackPlugin in objectstack.config.ts.',
    issue: 'https://github.com/objectstack-ai/framework/issues/2612',
  },
};

/** List-view visualisation types (ListViewSchema `type`). */
export const LIST_VIEW_TYPES = [
  'grid',
  'kanban',
  'gallery',
  'calendar',
  'timeline',
  'gantt',
  'map',
  'chart',
] as const;

/** Form-view layout types (FormViewSchema `type`). */
export const FORM_VIEW_TYPES = ['simple', 'tabbed', 'wizard', 'split', 'drawer'] as const;

/**
 * Human/CI-readable map of each coverage dimension to where it is exercised.
 * Useful as documentation and as a checklist when extending the showcase.
 */
export const COVERAGE = {
  fieldTypes: {
    source: 'FieldTypeSchema',
    coveredBy: 'data/objects/field-zoo.object.ts (+ relationship/date/select fields on the backbone objects)',
  },
  relationships: {
    coveredBy: [
      'lookup → project.account, category.parent (self-referencing tree)',
      'master_detail → task.project, project_membership.{team,project}',
      'many-to-many → showcase_project_membership junction',
    ],
  },
  listViewTypes: {
    expected: LIST_VIEW_TYPES,
    coveredBy: 'ui/views/task.view.ts (all 8) + ui/views/project.view.ts',
  },
  formViewTypes: {
    expected: FORM_VIEW_TYPES,
    coveredBy: 'ui/views/task.view.ts formViews (simple/tabbed/wizard/split/drawer)',
  },
  chartTypes: {
    source: 'ChartTypeSchema',
    coveredBy: 'ui/dashboards/chart-gallery.dashboard.ts (one widget per chart family)',
  },
  reportTypes: {
    source: 'ReportType',
    coveredBy: 'ui/reports/index.ts (tabular/summary/matrix/joined)',
  },
  actionTypesAndLocations: {
    source: 'ActionType + ACTION_LOCATIONS',
    coveredBy: 'ui/actions/index.ts (script/url/flow/modal/api/form across all locations)',
  },
  capabilityChains: {
    security: 'security/index.ts — roles + permission set (CRUD + FLS + RLS) + sharing + policy',
    automation: 'automation/flows/index.ts (incl. approval nodes) + automation/webhooks/index.ts + automation/jobs/index.ts + system/emails/index.ts',
  },
  i18nThemingPortals: {
    coveredBy: 'system/translations/index.ts (en + zh-CN), ui/themes/index.ts (light + dark), ui/portals/index.ts',
  },
  docs: {
    source: 'ADR-0046 (doc metadata)',
    coveredBy: 'src/docs/*.md — flat Markdown compiled to `doc` items: frontmatter title + first-heading title, cross-references with anchors, namespace-prefixed names',
  },
} as const;

/** Collect every field `type` used across a set of object definitions. */
export function collectFieldTypes(objects: Array<{ fields?: Record<string, { type?: string }> }>): Set<string> {
  const used = new Set<string>();
  for (const obj of objects) {
    for (const field of Object.values(obj.fields ?? {})) {
      if (field?.type) used.add(field.type);
    }
  }
  return used;
}

/** Collect every list-view `type` from a set of `defineView` results. */
export function collectListViewTypes(views: Array<{ list?: { type?: string }; listViews?: Record<string, { type?: string }> }>): Set<string> {
  const used = new Set<string>();
  for (const view of views) {
    if (view.list?.type) used.add(view.list.type);
    for (const lv of Object.values(view.listViews ?? {})) {
      if (lv?.type) used.add(lv.type);
    }
  }
  return used;
}

/** Collect every form-view `type` from a set of `defineView` results. */
export function collectFormViewTypes(views: Array<{ formViews?: Record<string, { type?: string }> }>): Set<string> {
  const used = new Set<string>();
  for (const view of views) {
    for (const fv of Object.values(view.formViews ?? {})) {
      if (fv?.type) used.add(fv.type);
    }
  }
  return used;
}
