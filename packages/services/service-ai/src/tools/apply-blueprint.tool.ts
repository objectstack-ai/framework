// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * apply_blueprint — AI Tool Metadata (ADR-0033 §4, plan-first)
 *
 * Batch-drafts every artifact in an (approved, possibly human-edited) solution
 * blueprint. Each object/view/dashboard is staged as a DRAFT (never published)
 * and validated against its type's Zod schema; a bad item is reported but does
 * not sink the rest. Call this ONLY after the human has approved the blueprint
 * returned by `propose_blueprint`.
 */
export const applyBlueprintTool = defineTool({
  name: 'apply_blueprint',
  label: 'Apply Blueprint',
  description:
    'Batch-draft all objects, views, and dashboards in an approved solution blueprint. Every artifact is staged as a draft for human review — nothing is published. ' +
    'Call this ONLY after the user has confirmed the blueprint from propose_blueprint. Pass the (possibly edited) blueprint object exactly.',
  category: 'data',
  builtIn: true,
  parameters: {
    type: 'object',
    properties: {
      blueprint: {
        type: 'object',
        description: 'The approved SolutionBlueprint object (the same shape propose_blueprint returned, with any human edits applied).',
      },
    },
    required: ['blueprint'],
    additionalProperties: false,
  },
});
