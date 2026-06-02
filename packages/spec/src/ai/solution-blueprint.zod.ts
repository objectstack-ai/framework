// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { lazySchema } from '../shared/lazy-schema';
import { FieldType } from '../data/field.zod';

/**
 * Solution Blueprint Schema (ADR-0033 §4 — plan-first authoring)
 *
 * The structured-output target an AI agent emits for a *high-level* goal
 * ("build me a project-management system") instead of transcribing a field
 * list. It is a **simplified proposal shape** — deliberately lighter than the
 * full {@link ObjectSchema} / {@link ViewSchema} / {@link DashboardSchema}.
 * The `apply_blueprint` tool expands each entry into a proper metadata body
 * and stages it as a draft (so the per-type Zod schema still validates the
 * real artifact at write time).
 *
 * The blueprint is **never persisted on its own**: the agent presents it for
 * conversational confirmation/edit (cheap), and only on human approval does it
 * batch-draft. This is the safety valve for low-specificity input.
 */

const SNAKE_CASE = /^[a-z_][a-z0-9_]*$/;

/**
 * A proposed field on a blueprint object. `reference` carries the target
 * object for `lookup` / `master_detail` types — relationships are expressed
 * inline as reference fields rather than in a separate block.
 */
export const BlueprintFieldSchema = lazySchema(() => z.object({
  name: z.string().regex(SNAKE_CASE).describe('Field machine name (snake_case)'),
  label: z.string().optional().describe('Human-readable field label'),
  type: FieldType.describe('Field data type'),
  required: z.boolean().optional().describe('Whether the field is required'),
  reference: z.string().regex(SNAKE_CASE).optional()
    .describe('Target object name for lookup / master_detail relationship fields'),
  options: z.array(z.object({
    label: z.string(),
    value: z.string().regex(SNAKE_CASE),
  })).optional().describe('Choices for select / multiselect / radio fields'),
}));
export type BlueprintField = z.infer<typeof BlueprintFieldSchema>;

/** A proposed business object (table) with its fields. */
export const BlueprintObjectSchema = lazySchema(() => z.object({
  name: z.string().regex(SNAKE_CASE).describe('Object machine name (snake_case)'),
  label: z.string().optional().describe('Human-readable singular label'),
  description: z.string().optional().describe('What this object represents'),
  fields: z.array(BlueprintFieldSchema).describe('Fields to create on the object'),
}));
export type BlueprintObject = z.infer<typeof BlueprintObjectSchema>;

/** A proposed list/form/kanban/calendar view over an object. */
export const BlueprintViewSchema = lazySchema(() => z.object({
  object: z.string().regex(SNAKE_CASE).describe('Object this view displays (snake_case)'),
  name: z.string().regex(SNAKE_CASE).describe('View machine name (snake_case)'),
  label: z.string().optional().describe('Human-readable view label'),
  type: z.enum(['list', 'form', 'kanban', 'calendar']).default('list').describe('View kind'),
  columns: z.array(z.string().regex(SNAKE_CASE)).optional()
    .describe('Field names shown as columns (in order)'),
}));
export type BlueprintView = z.infer<typeof BlueprintViewSchema>;

/** A proposed dashboard with a few widgets (kept intentionally light). */
export const BlueprintDashboardSchema = lazySchema(() => z.object({
  name: z.string().regex(SNAKE_CASE).describe('Dashboard machine name (snake_case)'),
  label: z.string().optional().describe('Human-readable dashboard label'),
  widgets: z.array(z.object({
    id: z.string().regex(SNAKE_CASE).describe('Widget id (snake_case)'),
    title: z.string().optional().describe('Widget title'),
    object: z.string().regex(SNAKE_CASE).optional().describe('Source object for the widget'),
    chart: z.enum(['metric', 'bar', 'line', 'pie', 'table']).optional().describe('Widget visualization'),
  })).optional().describe('Widgets to place on the dashboard'),
}));
export type BlueprintDashboard = z.infer<typeof BlueprintDashboardSchema>;

/**
 * A proposed navigation item in the blueprint app — points at one of the
 * created objects or dashboards. `apply_blueprint` expands it into the full
 * `AppSchema` nav item (object → list view, dashboard → dashboard view).
 */
export const BlueprintNavItemSchema = lazySchema(() => z.object({
  type: z.enum(['object', 'dashboard']).default('object').describe('What this nav entry opens'),
  target: z.string().regex(SNAKE_CASE).describe('Object or dashboard machine name to surface (snake_case)'),
  label: z.string().optional().describe('Nav entry label (defaults to the target label/name)'),
  icon: z.string().optional().describe('Lucide icon name for the nav entry'),
}));
export type BlueprintNavItem = z.infer<typeof BlueprintNavItemSchema>;

/**
 * The navigation shell (the thing end users open in the App Launcher) that
 * surfaces the solution. When `nav` is omitted, `apply_blueprint` auto-builds
 * one nav entry per created object (then per dashboard).
 */
export const BlueprintAppSchema = lazySchema(() => z.object({
  name: z.string().regex(SNAKE_CASE).describe('App machine name (snake_case)'),
  label: z.string().optional().describe('App display label'),
  icon: z.string().optional().describe('Lucide icon for the App Launcher'),
  nav: z.array(BlueprintNavItemSchema).optional()
    .describe('Navigation entries; omit to auto-surface every created object and dashboard'),
}));
export type BlueprintApp = z.infer<typeof BlueprintAppSchema>;

/**
 * Seed data the agent suggests. Mirrors {@link DatasetSchema.records}. NOTE:
 * Phase C does NOT auto-apply seed data — there is no runtime-draftable
 * `dataset` metadata type (seed = code-loaded `*.seed.ts`). `apply_blueprint`
 * reports it as "proposed, not applied" so a human can wire it deliberately.
 */
export const BlueprintSeedSchema = lazySchema(() => z.object({
  object: z.string().regex(SNAKE_CASE).describe('Target object name (snake_case)'),
  records: z.array(z.record(z.string(), z.unknown())).describe('Rows to seed'),
}));
export type BlueprintSeed = z.infer<typeof BlueprintSeedSchema>;

/**
 * The full plan-first blueprint. `assumptions` state the design choices the
 * agent made from an underspecified goal; `questions` (≤2) are the only
 * structure-deciding clarifications it should ask before proposing.
 */
export const SolutionBlueprintSchema = lazySchema(() => z.object({
  summary: z.string().describe('One-line description of the proposed solution'),
  assumptions: z.array(z.string()).default([])
    .describe('Design assumptions made from the underspecified goal'),
  questions: z.array(z.string()).max(2).optional()
    .describe('At most 1-2 structure-deciding questions to confirm before building'),
  objects: z.array(BlueprintObjectSchema).describe('Objects (tables) to create'),
  views: z.array(BlueprintViewSchema).optional().describe('Views to create'),
  dashboards: z.array(BlueprintDashboardSchema).optional().describe('Dashboards to create'),
  app: BlueprintAppSchema.optional()
    .describe('The navigation shell (app) that surfaces the created objects/dashboards to end users'),
  seedData: z.array(BlueprintSeedSchema).optional()
    .describe('Suggested seed data (reported, not auto-applied in Phase C)'),
}));
export type SolutionBlueprint = z.infer<typeof SolutionBlueprintSchema>;

/**
 * Factory mirroring `defineAgent` / `defineTool` / `defineSkill`: validates a
 * blueprint literal at authoring time and returns the parsed value.
 */
export function defineSolutionBlueprint(config: z.input<typeof SolutionBlueprintSchema>): SolutionBlueprint {
  return SolutionBlueprintSchema.parse(config);
}
